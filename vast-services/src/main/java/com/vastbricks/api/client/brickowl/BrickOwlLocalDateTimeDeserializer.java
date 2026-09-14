package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Reads a BrickOwl moment, whichever of its two spellings it arrives in, as the same moment in UTC.
 *
 * <p>BrickOwl states one time twice over and never the same way: {@code order_time} is seconds since the epoch and
 * {@code iso_order_time} is a wall clock with an offset - and the offset is London's, {@code +01:00} in summer and
 * {@code +00:00} in winter, rather than UTC. So the two fields of one order describe one instant in two forms, and
 * reading them apart is what made them disagree.
 *
 * <p>They used to. The epoch was resolved in whatever zone the host ran in and the ISO string had its offset thrown
 * away, so the same order came out as a different wall time depending on which field was read and which machine
 * read it. That is one bug with three faces: an order placed after ten at night was dated a day later by the live
 * report than by the copy imported from the archive; the same order was archived twice, once under a name a UTC
 * host chose and once under a Riga host's; and a stored instant was an hour out all summer.
 *
 * <p>UTC because the deployment runs in it, so a moment read here is the moment the server would have called it
 * anyway, and an archive file is named the same wherever the job happens to run.
 */
class BrickOwlLocalDateTimeDeserializer extends JsonDeserializer<LocalDateTime> {

    @Override
    public LocalDateTime deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        var value = parser.getValueAsString();
        if (value == null || value.isBlank()) {
            return null;
        }
        if (value.chars().allMatch(Character::isDigit)) {
            return Instant.ofEpochSecond(Long.parseLong(value)).atZone(ZoneOffset.UTC).toLocalDateTime();
        }
        // The same instant, not the same wall clock: the offset says what the digits before it mean, so it is
        // converted rather than dropped.
        return OffsetDateTime.parse(value).atZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }
}
