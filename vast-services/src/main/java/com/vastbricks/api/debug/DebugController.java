package com.vastbricks.api.debug;

import com.vastbricks.api.auth.AuthenticatedUser;
import com.vastbricks.api.debug.DebugPayload.BodyFileResponse;
import com.vastbricks.api.debug.DebugPayload.ExchangeResponse;
import com.vastbricks.api.debug.DebugPayload.ExchangesResponse;
import com.vastbricks.api.debug.DebugPayload.RecordingRequest;
import com.vastbricks.api.debug.DebugPayload.RecordingResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * The debug dock's network tab: what this user's requests sent to providers and what came back.
 *
 * <p>Everything here is scoped to the caller. Recording is armed per user, rows are written under the user whose
 * request caused the call, and a read or a clear only ever touches that user's own rows.
 */
@RestController
@RequestMapping(path = "/api/private/debug/http", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class DebugController {

    /** Rows returned per poll. A page the panel can render without stalling, and a bound on one query. */
    private static final int PAGE_SIZE = 100;

    private static final String REQUEST = "request";
    private static final String RESPONSE = "response";

    /**
     * What a saved body is named after its type. A short list of what providers here actually answer with, and
     * {@code bin} for everything else: a name is a convenience, and the content type is what says what the file is.
     */
    private static final Map<String, String> FILE_EXTENSIONS = Map.of(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx",
            "application/vnd.ms-excel", "xls",
            "application/pdf", "pdf",
            "application/zip", "zip",
            "text/csv", "csv",
            "image/png", "png",
            "image/jpeg", "jpg"
    );

    private final DebugRecordingService recording;
    private final DebugHttpExchangeRepository exchanges;

    @GetMapping("/recording")
    RecordingResponse recording(HttpServletRequest request) {
        var userId = callerId(request);
        return new RecordingResponse(recording.isRecording(userId), recording.recordingUntil(userId));
    }

    @PostMapping("/recording")
    RecordingResponse setRecording(HttpServletRequest request, @RequestBody RecordingRequest body) {
        var userId = callerId(request);
        var until = recording.setRecording(userId, body.isEnabled());
        return new RecordingResponse(body.isEnabled(), until);
    }

    @GetMapping("/exchanges")
    ExchangesResponse exchanges(HttpServletRequest request, @RequestParam(name = "afterId", required = false) Long afterId) {
        var page = exchanges.findByUserIdAndIdGreaterThanOrderByIdAsc(
                callerId(request),
                afterId == null ? 0L : afterId,
                Limit.of(PAGE_SIZE + 1)
        );
        var more = page.size() > PAGE_SIZE;
        var returned = more ? page.subList(0, PAGE_SIZE) : page;
        var nextCursor = returned.isEmpty() ? afterId : returned.getLast().getId();
        return new ExchangesResponse(returned.stream().map(DebugController::toResponse).toList(), nextCursor, more);
    }

    /**
     * The request body of one exchange as the file it was, where it was not text.
     *
     * <p>A body a provider answered as a spreadsheet or a PDF is worth opening in the program that reads it rather
     * than staring at as replacement characters, so the panel shows a note about it and hands the bytes over here.
     * The two sides are two mappings rather than one taking which side to serve: there are exactly two of them, and
     * neither can then be asked for wrongly.
     */
    @GetMapping(path = "/exchanges/{id}/request-body", produces = MediaType.ALL_VALUE)
    ResponseEntity<byte[]> requestBodyFile(HttpServletRequest request, @PathVariable("id") Long id) {
        var exchange = own(request, id);
        return file(exchange, REQUEST, exchange.getRequestBodyFile(), exchange.getRequestBodyContentType());
    }

    @GetMapping(path = "/exchanges/{id}/response-body", produces = MediaType.ALL_VALUE)
    ResponseEntity<byte[]> responseBodyFile(HttpServletRequest request, @PathVariable("id") Long id) {
        var exchange = own(request, id);
        return file(exchange, RESPONSE, exchange.getResponseBodyFile(), exchange.getResponseBodyContentType());
    }

    @DeleteMapping("/exchanges")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void clear(HttpServletRequest request) {
        exchanges.deleteByUserId(callerId(request));
    }

    /**
     * One of the caller's own exchanges. A row belonging to somebody else is reported as missing rather than as
     * forbidden: whose traffic exists is not this caller's business either.
     */
    private DebugHttpExchange own(HttpServletRequest request, Long id) {
        return exchanges.findByIdAndUserId(id, callerId(request))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such recorded exchange"));
    }

    private static ResponseEntity<byte[]> file(
            DebugHttpExchange exchange,
            String side,
            byte[] bytes,
            String contentType
    ) {
        if (bytes == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "That body was not kept as a file");
        }
        return ResponseEntity.ok()
                .contentType(mediaType(contentType))
                .contentLength(bytes.length)
                // As an attachment: the point of keeping it is saving it, and a browser asked to display a
                // spreadsheet inline does nothing useful with it.
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename(exchange, side, contentType)).build().toString()
                )
                .body(bytes);
    }

    private static MediaType mediaType(String contentType) {
        try {
            return contentType == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(contentType);
        } catch (InvalidMediaTypeException exception) {
            // A provider is free to state nonsense; the bytes are still worth handing over.
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    /**
     * What the download is saved as: the provider, the exchange it came from and which side of it, so a folder of
     * saved bodies still says where each came from, with the extension its type is normally read under.
     */
    private static String filename(DebugHttpExchange exchange, String side, String contentType) {
        var provider = exchange.getProvider().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        return provider + "-" + exchange.getId() + "-" + side + "." + extension(contentType);
    }

    private static String extension(String contentType) {
        if (contentType == null) {
            return "bin";
        }
        return FILE_EXTENSIONS.getOrDefault(contentType.toLowerCase(Locale.ROOT).trim(), "bin");
    }

    private long callerId(HttpServletRequest request) {
        return AuthenticatedUser.idOf(request)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required"));
    }

    private static ExchangeResponse toResponse(DebugHttpExchange exchange) {
        return new ExchangeResponse(
                exchange.getId(),
                exchange.getRecordedAt(),
                exchange.getProvider(),
                exchange.getMethod(),
                exchange.getUrl(),
                exchange.getRequestBody(),
                bodyFile(exchange, REQUEST, exchange.getRequestBodyFile(), exchange.getRequestBodyContentType()),
                exchange.getStatusCode(),
                exchange.getResponseBody(),
                bodyFile(exchange, RESPONSE, exchange.getResponseBodyFile(), exchange.getResponseBodyContentType()),
                exchange.getDurationMillis(),
                exchange.isTruncated()
        );
    }

    /** What downloading one side would hand over, or {@code null} where that side was text or was not kept. */
    private static BodyFileResponse bodyFile(
            DebugHttpExchange exchange,
            String side,
            byte[] bytes,
            String contentType
    ) {
        if (bytes == null) {
            return null;
        }
        return new BodyFileResponse(contentType, bytes.length, filename(exchange, side, contentType));
    }
}
