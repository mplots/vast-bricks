package com.vastbricks.market.owl;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;

class OwlLocalDateTimeDeserializer extends JsonDeserializer<LocalDateTime> {
    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        var value = parser.getValueAsString();
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.chars().allMatch(Character::isDigit)) {
            return Instant.ofEpochSecond(Long.parseLong(value))
                    .atZone(ZoneId.systemDefault())
                    .toLocalDateTime();
        }
        return OffsetDateTime.parse(value).toLocalDateTime();
    }
}
