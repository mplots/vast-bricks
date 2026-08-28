package com.vastbricks.api.tor;

import lombok.Getter;

@Getter
public class TorCircuitResponse {

    private final String previousIpAddress;
    private final String currentIpAddress;
    private final boolean changed;
    private final long elapsedMillis;
    private final int attempts;

    public TorCircuitResponse(TorCircuitChange change) {
        this.previousIpAddress = change.getPreviousIpAddress();
        this.currentIpAddress = change.getCurrentIpAddress();
        this.changed = change.isChanged();
        this.elapsedMillis = change.getElapsedMillis();
        this.attempts = change.getAttempts();
    }
}
