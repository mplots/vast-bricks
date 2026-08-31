package com.vastbricks.api.flyway;

import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;

@RequiredArgsConstructor
@Slf4j
class VastDatabaseMigration {

    private static final String MIGRATION_LOCATION = "classpath:db/vast/migration";
    private static final String HISTORY_TABLE = "vast_schema_history";

    private final DataSource dataSource;
    private final FlywaySettings settings;

    void migrate() {
        if (!settings.isMigrationsEnabled()) {
            log.info("Vast database migrations are disabled by VAST_DB_MIGRATIONS_ENABLED.");
            return;
        }

        String schema = settings.getSchema();
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations(MIGRATION_LOCATION)
                .schemas(schema)
                .defaultSchema(schema)
                .table(HISTORY_TABLE)
                .createSchemas(true)
                .cleanDisabled(false)
                .load();

        log.info("Running Vast database migrations in schema '{}'.", schema);
        if (settings.isCleanOnStartup()) {
            log.warn("Cleaning Vast database schema '{}' before migrations.", schema);
            flyway.clean();
        }
        flyway.migrate();
    }
}
