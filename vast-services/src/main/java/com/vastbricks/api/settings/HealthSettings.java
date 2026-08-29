package com.vastbricks.api.settings;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class HealthSettings extends DatabaseBackedSettings {

    @Value("${VAST_HEALTH_SETTING_VALUE:default-health-value}")
    private String value;

    @Value("${VAST_HEALTH_SETTING_ENV_VALUE:health-env-default}")
    private String environmentValue;

    @Value("${VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE:}")
    private String databaseOnlyValue;
}
