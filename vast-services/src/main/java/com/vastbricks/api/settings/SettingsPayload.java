package com.vastbricks.api.settings;

import lombok.Value;

/** Every request and response body of the settings feature. */
final class SettingsPayload {

    private SettingsPayload() {
    }

    @Value
    public static class HealthSettingsResponse {

        String value;
        String environmentValue;
        String databaseOnlyValue;
        String secretValue;
    }
}
