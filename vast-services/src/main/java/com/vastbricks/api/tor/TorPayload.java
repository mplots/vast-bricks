package com.vastbricks.api.tor;

import lombok.Getter;

/** Every request and response body of the Tor feature. Public because {@link TorController} is. */
public final class TorPayload {

    private TorPayload() {
    }

    @Getter
    public static final class TorCircuitResponse {

        private final String previousIpAddress;
        private final String currentIpAddress;
        private final boolean changed;
        private final long elapsedMillis;
        private final int attempts;

        TorCircuitResponse(TorCircuitChange change) {
            this.previousIpAddress = change.getPreviousIpAddress();
            this.currentIpAddress = change.getCurrentIpAddress();
            this.changed = change.isChanged();
            this.elapsedMillis = change.getElapsedMillis();
            this.attempts = change.getAttempts();
        }
    }
}
