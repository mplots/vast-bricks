package com.vastbricks.api.flyway;

import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Getter
@Component
class FlywaySettings {

    @VastSetting(env = "VAST_DB_SCHEMA")
    private String schema = "vast";

    @VastSetting(env = "VAST_DB_MIGRATIONS_ENABLED")
    private boolean migrationsEnabled = true;

    @VastSetting(env = "VAST_DB_CLEAN_ON_STARTUP")
    private boolean cleanOnStartup = false;
}
