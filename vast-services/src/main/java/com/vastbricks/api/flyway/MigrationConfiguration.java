package com.vastbricks.api.flyway;

import javax.sql.DataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class MigrationConfiguration {

    @Bean(initMethod = "migrate")
    VastDatabaseMigration vastDatabaseMigration(DataSource dataSource, FlywaySettings settings) {
        return new VastDatabaseMigration(dataSource, settings);
    }
}
