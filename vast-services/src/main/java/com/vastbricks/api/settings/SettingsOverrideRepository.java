package com.vastbricks.api.settings;

import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class SettingsOverrideRepository {

    private static final Pattern DATABASE_IDENTIFIER = Pattern.compile("[A-Za-z_][A-Za-z0-9_]*");

    private final JdbcTemplate jdbcTemplate;
    private final String tableName;

    SettingsOverrideRepository(JdbcTemplate jdbcTemplate, SettingsOverrideSettings settings) {
        this.jdbcTemplate = jdbcTemplate;
        this.tableName = quotedIdentifier(settings.getSchema()) + ".settings_override";
    }

    Optional<String> findValue(String profile, String settingKey) {
        return jdbcTemplate.query(
                "SELECT setting_value FROM " + tableName + " WHERE profile = ? AND setting_key = ?",
                resultSet -> {
                    if (!resultSet.next()) {
                        return Optional.empty();
                    }
                    return Optional.of(resultSet.getString("setting_value"));
                },
                profile,
                settingKey
        );
    }

    void upsertValue(String profile, String settingKey, String settingValue) {
        jdbcTemplate.update(
                "INSERT INTO " + tableName + " (profile, setting_key, setting_value) VALUES (?, ?, ?) "
                        + "ON CONFLICT (profile, setting_key) DO UPDATE SET "
                        + "setting_value = EXCLUDED.setting_value, updated_at = now()",
                profile,
                settingKey,
                settingValue
        );
    }

    private String quotedIdentifier(String value) {
        if (!DATABASE_IDENTIFIER.matcher(value).matches()) {
            throw new SettingsOverrideException("Unsupported database schema name for settings overrides: " + value);
        }
        return "\"" + value + "\"";
    }
}
