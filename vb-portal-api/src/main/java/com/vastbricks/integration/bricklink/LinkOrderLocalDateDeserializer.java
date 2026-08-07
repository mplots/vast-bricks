package com.vastbricks.integration.bricklink;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

class LinkOrderLocalDateDeserializer extends JsonDeserializer<LocalDate> {
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("M/d/uuuu");

    @Override
    public LocalDate deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        var value = parser.getValueAsString();
        return value == null || value.isBlank() ? null : LocalDate.parse(value, FORMATTER);
    }
}
