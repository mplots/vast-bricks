package com.vastbricks.api.stripeledger;

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
 * The span of time the Stripe transaction screen is reading.
 *
 * <p>Written the way the bank statement screen's period is, and for the same reason: the screen reads a month at a
 * time while a month is being looked over and a whole year when a year is, so the span is asked for as the shape it
 * is — {@code YYYY-MM} for a month, {@code YYYY} for a year — and nothing past this class has to ask which of the
 * two was requested.
 *
 * <p>Unlike a booking date, a balance transaction is dated by an instant, and Stripe dates it in UTC. So the period
 * becomes a UTC window from the first day at 00:00:00 to the last day at 23:59:59, both ends included, exactly as
 * the reconciliation payment window is asked for. There is no padding here: reconciliation pads because a payment is
 * not dated where its order is, and this screen reads the ledger itself, where a transaction belongs to the period
 * Stripe dated it in.
 */
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class StripeLedgerPeriod {

    private final Instant from;
    private final Instant to;

    /**
     * The period a request named, either as a month or as a year.
     *
     * @throws IllegalArgumentException when it is neither, which the controller answers as a bad request
     */
    static StripeLedgerPeriod of(String period) {
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

    private static StripeLedgerPeriod between(LocalDate firstDay, LocalDate lastDay) {
        return new StripeLedgerPeriod(
                firstDay.atStartOfDay().toInstant(ZoneOffset.UTC),
                lastDay.atTime(23, 59, 59).toInstant(ZoneOffset.UTC)
        );
    }
}
