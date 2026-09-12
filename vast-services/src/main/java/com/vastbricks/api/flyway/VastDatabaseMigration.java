package com.vastbricks.api.flyway;

import com.vastbricks.api.setup.SetupEncryption;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.flywaydb.core.Flyway;
import org.springframework.core.env.Environment;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

@RequiredArgsConstructor
@Slf4j
class VastDatabaseMigration {

    private static final String MIGRATION_LOCATION = "classpath:db/vast/migration";
    private static final String LOCAL_DATA_MIGRATION_LOCATION = "classpath:db/vast/migration/data";
    private static final String HISTORY_TABLE = "vast_schema_history";

    private static final String SEED_SCRIPTS = "classpath*:db/vast/migration/data/*.sql";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([A-Za-z_][A-Za-z0-9_]*)}");
    private static final String ENCRYPTED_SUFFIX = "_ENCRYPTED";

    private final DataSource dataSource;
    private final FlywaySettings settings;
    private final Environment environment;
    private final SetupEncryption encryption;

    void migrate() {
        if (!settings.isMigrationsEnabled()) {
            log.info("Vast database migrations are disabled by VAST_DB_MIGRATIONS_ENABLED.");
            return;
        }

        String schema = settings.getSchema();
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations(MIGRATION_LOCATION, LOCAL_DATA_MIGRATION_LOCATION)
                .schemas(schema)
                .defaultSchema(schema)
                .table(HISTORY_TABLE)
                .createSchemas(true)
                .cleanDisabled(false)
                .placeholders(seedPlaceholders())
                .load();

        log.info("Running Vast database migrations in schema '{}'.", schema);
        if (settings.isCleanOnStartup()) {
            log.warn("Cleaning Vast database schema '{}' before migrations.", schema);
            flyway.clean();
        }
        flyway.migrate();
    }

    /**
     * What the local data seed reaches the environment through: each name it asks for as the environment gives it,
     * and the same name suffixed _ENCRYPTED as ciphertext the application reads back. That suffix is the whole
     * reason seeding needs Java, since a secret is stored encrypted under the runtime's own key and SQL cannot
     * encrypt.
     *
     * <p>Read from the scripts rather than listed here, so a seed that starts using another credential needs no
     * change on this side. A name the environment does not answer resolves to an empty string rather than failing
     * the migration, which is every name in a runtime given no environment file - the acceptance runtime above all.
     */
    private Map<String, String> seedPlaceholders() {
        Map<String, String> placeholders = new HashMap<>();
        for (String placeholder : seedPlaceholderNames()) {
            String name = StringUtils.removeEnd(placeholder, ENCRYPTED_SUFFIX);
            String value = environment.getProperty(name, "");
            boolean encrypted = !name.equals(placeholder) && !value.isBlank();
            placeholders.put(placeholder, encrypted ? encryption.encrypt(value) : value);
        }
        return placeholders;
    }

    /** Every placeholder the seed scripts name. None in a production build, which carries no seed scripts at all. */
    private Set<String> seedPlaceholderNames() {
        Set<String> names = new LinkedHashSet<>();
        try {
            for (Resource script : new PathMatchingResourcePatternResolver().getResources(SEED_SCRIPTS)) {
                Matcher placeholders = PLACEHOLDER.matcher(script.getContentAsString(StandardCharsets.UTF_8));
                while (placeholders.find()) {
                    names.add(placeholders.group(1));
                }
            }
        } catch (IOException ex) {
            throw new UncheckedIOException("Failed to read the Vast local data seed scripts.", ex);
        }
        return names;
    }
}
