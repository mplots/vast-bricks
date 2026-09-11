package com.vastbricks.api.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.type.format.jackson.JacksonJsonFormatMapper;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

/**
 * Reads and writes every {@code @JdbcTypeCode(SqlTypes.JSON)} column with the application's own Jackson, rather
 * than the bare ObjectMapper Hibernate would otherwise build for itself.
 *
 * <p>What that buys is tolerance of its own history. Spring's mapper ignores properties a class no longer declares,
 * so dropping a field from a JSON-mapped class still reads the rows written while it had one; Hibernate's own
 * mapper fails the whole read instead, which turns a rename into unreadable rows. It also means a column is written
 * by the same Jackson that writes the API's own responses, so the two never disagree about a value's shape.
 */
@Component
@RequiredArgsConstructor
class JsonColumnMapping implements HibernatePropertiesCustomizer {

    private final ObjectMapper objectMapper;

    @Override
    public void customize(Map<String, Object> hibernateProperties) {
        hibernateProperties.put(AvailableSettings.JSON_FORMAT_MAPPER, new JacksonJsonFormatMapper(objectMapper));
    }
}
