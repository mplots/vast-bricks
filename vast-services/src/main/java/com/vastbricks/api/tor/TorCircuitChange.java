package com.vastbricks.api.tor;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
class TorCircuitChange {

    private final String previousIpAddress;
    private final String currentIpAddress;

    public boolean isChanged() {
        return !previousIpAddress.equals(currentIpAddress);
    }
}
