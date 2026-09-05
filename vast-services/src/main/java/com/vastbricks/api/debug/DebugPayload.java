package com.vastbricks.api.debug;

import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Every request and response body of the debug feature. */
final class DebugPayload {

    private DebugPayload() {
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static final class RecordingRequest {

        private boolean enabled;
    }

    @Getter
    @AllArgsConstructor
    public static final class RecordingResponse {

        private final boolean recording;

        /** When recording stops by itself, or {@code null} when it is not running. */
        private final Instant recordingUntil;
    }

    /** A page of the caller's recorded traffic, oldest first, with the cursor to ask for the next one. */
    @Getter
    @AllArgsConstructor
    public static final class ExchangesResponse {

        private final List<ExchangeResponse> exchanges;

        /** Pass back as {@code afterId} to get what was recorded next. */
        private final Long nextCursor;

        /** Whether more was already waiting, so the panel can keep reading instead of waiting for the next poll. */
        private final boolean more;
    }

    @Getter
    @AllArgsConstructor
    public static final class ExchangeResponse {

        private final Long id;
        private final Instant recordedAt;
        private final String provider;
        private final String method;
        private final String url;
        private final String requestBody;
        private final int statusCode;
        private final String responseBody;
        private final long durationMillis;
        private final boolean truncated;
    }
}
