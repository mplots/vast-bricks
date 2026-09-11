package com.vastbricks.api.settings;

import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
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

    /**
     * One {@code @VastSetting(databaseOverride = true)} field, as shown to a tenant. {@code value} is null for a
     * secret setting: the screen only ever writes a secret, it never reads one back. {@code configured} is what a
     * "reset to default" action has to offer: whether this tenant has an override to clear, not merely whether the
     * effective value happens to be non-blank.
     */
    @Value
    public static class VastSettingView {

        String settingKey;
        String group;
        String label;
        boolean secret;
        boolean configured;
        String value;
    }

    @Value
    public static class VastSettingsResponse {

        List<VastSettingView> settings;
    }

    /** Keyed by setting key. A blank or missing value leaves that setting exactly as it was. */
    @Getter
    @Setter
    @NoArgsConstructor
    public static class VastSettingsUpdateRequest {

        private Map<String, String> values;
    }
}
