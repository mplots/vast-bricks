package com.vastbricks.api.flyway;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class FlywaySettings {

    @Value("${VAST_DB_SCHEMA:vast}")
    private String schema;

    @Value("${VAST_DB_MIGRATIONS_ENABLED:true}")
    private boolean migrationsEnabled;

    @Value("${VAST_DB_CLEAN_ON_STARTUP:false}")
    private boolean cleanOnStartup;
}
