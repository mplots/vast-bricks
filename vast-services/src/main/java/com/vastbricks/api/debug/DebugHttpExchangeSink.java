package com.vastbricks.api.debug;

import com.vastbricks.api.client.HttpExchangeSink;
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
     * How much of a body is kept. A provider batch can answer megabytes, and one pathological response should not
     * bloat a row or the panel; the metadata and the start of the body are what a reader needs.
     */
    static final int BODY_LIMIT = 1_000_000;

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
        var row = new DebugHttpExchange();
        row.setUserId(userId);
        row.setRecordedAt(Instant.now());
        row.setProvider(provider);
        row.setMethod(call.getMethod());
        row.setUrl(call.getUrl());
        row.setRequestBody(capped(call.getRequestBody()));
        row.setStatusCode(call.getStatusCode());
        row.setResponseBody(capped(call.getResponseBody()));
        row.setDurationMillis(call.getDurationMillis());
        row.setTruncated(isOverLimit(call.getRequestBody()) || isOverLimit(call.getResponseBody()));
        return row;
    }

    private boolean isOverLimit(String body) {
        return body != null && body.length() > BODY_LIMIT;
    }

    private String capped(String body) {
        return isOverLimit(body) ? body.substring(0, BODY_LIMIT) : body;
    }
}
