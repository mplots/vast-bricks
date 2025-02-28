package com.vastbricks.config;

import lombok.AllArgsConstructor;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@AllArgsConstructor
public class FlywayConfig {

    private Env env;

    @Bean
    public FlywayMigrationStrategy flywayCleanMigrationStrategy() {
        return flyway -> {
            if (env.getFlywayClenOnStartup()) {
                flyway.clean();
            }
            flyway.migrate();
        };
    }
}
