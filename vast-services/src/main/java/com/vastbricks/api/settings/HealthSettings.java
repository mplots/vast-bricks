package com.vastbricks.api.settings;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class HealthSettings extends DatabaseBackedSettings {

    @Value("${VAST_HEALTH_SETTING_VALUE:default-health-value}")
    private String value;
}
