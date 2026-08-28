package com.vastbricks.api.tor;

import lombok.Getter;

@Getter
public class TorCircuitResponse {

    private final String previousIpAddress;
    private final String currentIpAddress;
    private final boolean changed;

    public TorCircuitResponse(TorCircuitChange change) {
        this.previousIpAddress = change.getPreviousIpAddress();
        this.currentIpAddress = change.getCurrentIpAddress();
        this.changed = change.isChanged();
    }
}
