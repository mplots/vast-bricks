package com.vastbricks.api.debug;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Which users are recording, and until when.
 *
 * <p>Recording is per user rather than per process: a user sees the traffic of their own requests and nobody else's.
 * It expires on its own so a session left armed stops writing provider payloads by itself; the panel re-arms with one
 * click. Held in memory, so a restart stops every recording, which is the safe direction to fail in.
 */
@Service
class DebugRecordingService {

    static final Duration RECORDING_DURATION = Duration.ofMinutes(30);

    private final Map<Long, Instant> recordingUntil = new ConcurrentHashMap<>();

    boolean isRecording(long userId) {
        var until = recordingUntil.get(userId);
        if (until == null) {
            return false;
        }
        if (until.isBefore(Instant.now())) {
            recordingUntil.remove(userId, until);
            return false;
        }
        return true;
    }

    /** Arms or disarms this user's recording, and reports when it now runs until. */
    Instant setRecording(long userId, boolean enabled) {
        if (!enabled) {
            recordingUntil.remove(userId);
            return null;
        }
        var until = Instant.now().plus(RECORDING_DURATION);
        recordingUntil.put(userId, until);
        return until;
    }

    Instant recordingUntil(long userId) {
        return isRecording(userId) ? recordingUntil.get(userId) : null;
    }
}
