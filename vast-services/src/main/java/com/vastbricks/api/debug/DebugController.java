package com.vastbricks.api.debug;

import com.vastbricks.api.auth.AuthenticatedUser;
import com.vastbricks.api.debug.DebugPayload.ExchangeResponse;
import com.vastbricks.api.debug.DebugPayload.ExchangesResponse;
import com.vastbricks.api.debug.DebugPayload.RecordingRequest;
import com.vastbricks.api.debug.DebugPayload.RecordingResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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

    @DeleteMapping("/exchanges")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void clear(HttpServletRequest request) {
        exchanges.deleteByUserId(callerId(request));
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
                exchange.getStatusCode(),
                exchange.getResponseBody(),
                exchange.getDurationMillis(),
                exchange.isTruncated()
        );
    }
}
