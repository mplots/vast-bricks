package com.vastbricks.api.settings;

import lombok.Value;

@Value
class HealthSettingsResponse {

    String value;
    String environmentValue;
    String databaseOnlyValue;
    String secretValue;
}
