package com.vastbricks.api.settings;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class SettingsOverrideSettings {

    @Value("${VAST_DB_SCHEMA:vast}")
    private String schema;
}
