package com.vastbricks.api.ledger;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * The span of time a ledger screen is reading.
 *
 * <p>A ledger is read a month at a time while a month is being looked over and a whole year when a year is, so the
 * span is asked for as the shape it is — {@code YYYY-MM} for a month, {@code YYYY} for a year — and nothing past
 * this class has to ask which of the two was requested. The bank statement screen asks for its period the same way,
 * and reads it as a pair of booking days rather than as a window of instants, which is why it keeps a period of its
 * own.
 *
 * <p>A provider dates a transaction by an instant, and both providers date it in UTC, so the period becomes a UTC
 * window from the first day at 00:00:00 to the last day at 23:59:59, both ends included. There is no padding here:
 * reconciliation pads its payment window because a payment is not dated where its order is, and a ledger screen
 * reads the ledger itself, where a transaction belongs to the period the provider dated it in.
 *
 * <p>It is shared rather than written once per ledger because it is one capability with one contract: the Stripe and
 * PayPal transaction screens ask for a period in the same words and mean the same window by it, and two copies of
 * this would be two answers to the same question waiting to drift apart.
 */
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
public final class LedgerPeriod {

    private final Instant from;
    private final Instant to;

    /**
     * The period a request named, either as a month or as a year.
     *
     * @throws IllegalArgumentException when it is neither, which a controller answers as a bad request
     */
    public static LedgerPeriod of(String period) {
        var stated = period == null ? "" : period.trim();
        try {
            // A year is the shorter of the two forms, so the length tells them apart before either is parsed and a
            // month is never read as a year whose separator was mistyped.
            if (stated.length() == 4) {
                var year = Year.parse(stated);
                return between(year.atDay(1), year.atMonth(12).atEndOfMonth());
            }
            var month = YearMonth.parse(stated);
            return between(month.atDay(1), month.atEndOfMonth());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("A period must be written as YYYY-MM or YYYY: " + period, e);
        }
    }

    private static LedgerPeriod between(LocalDate firstDay, LocalDate lastDay) {
        return new LedgerPeriod(
                firstDay.atStartOfDay().toInstant(ZoneOffset.UTC),
                lastDay.atTime(23, 59, 59).toInstant(ZoneOffset.UTC)
        );
    }
}
