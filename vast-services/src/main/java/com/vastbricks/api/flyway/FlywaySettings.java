package com.vastbricks.api.flyway;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class FlywaySettings {

    // Migration bootstrap must not depend on @VastSetting because its database
    // override table is created by these migrations.
    @Value("${VAST_DB_SCHEMA:vast}")
    private String schema = "vast";

    @Value("${VAST_DB_MIGRATIONS_ENABLED:true}")
    private boolean migrationsEnabled = true;

    @Value("${VAST_DB_CLEAN_ON_STARTUP:false}")
    private boolean cleanOnStartup = false;
}
