package com.vastbricks.api.debug;

import com.vastbricks.api.client.HttpExchangeSink;
import com.vastbricks.api.client.RawHttpBody;
import com.vastbricks.api.client.RawHttpCall;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Keeps recorded provider traffic for the user whose request caused it, and only while that user is recording.
 *
 * <p>Nothing is stored otherwise: capture is off until someone presses Record, so an ordinary request costs a
 * thread-local check and writes nothing. A call made with no user on the thread — a scheduled job, or a task that
 * lost the context crossing a thread — belongs to nobody and is dropped rather than stored unattributed.
 */
@Component
@RequiredArgsConstructor
class DebugHttpExchangeSink implements HttpExchangeSink {

    /**
     * How much of a text body is kept. A provider batch can answer megabytes, and one pathological response should not
     * bloat a row or the panel; the metadata and the start of the body are what a reader needs.
     */
    static final int BODY_LIMIT = 1_000_000;

    /**
     * How large a body kept as a file may be. Generous enough for the exports and labels a provider hands over, and
     * bounded, because these rows live in the database until someone presses Clear.
     *
     * <p>A file over it is not stored at all rather than cut short: a truncated spreadsheet is a corrupt file, not a
     * shorter one, so there would be nothing worth downloading. The note in the body column still says what it was.
     */
    static final int FILE_LIMIT = 5_000_000;

    private final DebugHttpExchangeRepository exchanges;
    private final DebugRecordingService recording;

    @Override
    public void record(String provider, List<RawHttpCall> calls) {
        var userId = DebugContext.currentUserId().orElse(null);
        if (userId == null || !recording.isRecording(userId)) {
            return;
        }
        exchanges.saveAll(calls.stream().map(call -> toRow(userId, provider, call)).toList());
    }

    private DebugHttpExchange toRow(long userId, String provider, RawHttpCall call) {
        var request = call.getRequestBody();
        var response = call.getResponseBody();

        var row = new DebugHttpExchange();
        row.setUserId(userId);
        row.setRecordedAt(Instant.now());
        row.setProvider(provider);
        row.setMethod(call.getMethod());
        row.setUrl(call.getUrl());
        row.setRequestBody(capped(request.getText()));
        row.setStatusCode(call.getStatusCode());
        row.setResponseBody(capped(response.getText()));
        row.setDurationMillis(call.getDurationMillis());
        row.setTruncated(isOverLimit(request) || isOverLimit(response));

        if (keepsFile(request)) {
            row.setRequestBodyFile(request.getBytes());
            row.setRequestBodyContentType(request.getContentType());
        }
        if (keepsFile(response)) {
            row.setResponseBodyFile(response.getBytes());
            row.setResponseBodyContentType(response.getContentType());
        }
        return row;
    }

    private boolean keepsFile(RawHttpBody body) {
        return body.isFile() && body.getBytes().length <= FILE_LIMIT;
    }

    private boolean isOverLimit(RawHttpBody body) {
        if (body.isFile()) {
            return body.getBytes().length > FILE_LIMIT;
        }
        return isOverLimit(body.getText());
    }

    private boolean isOverLimit(String body) {
        return body != null && body.length() > BODY_LIMIT;
    }

    private String capped(String body) {
        return isOverLimit(body) ? body.substring(0, BODY_LIMIT) : body;
    }
}
