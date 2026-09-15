package com.vastbricks.api.ledger.bank;

import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * The span of booking dates a bank statement screen is reading.
 *
 * <p>The screen reads one month at a time to write mappings against entries, one year at a time to see what a year
 * came to, and any span of days a reader draws for themselves, so the span is asked for as the shape it is:
 * {@code YYYY-MM} for a month, {@code YYYY} for a year, and a pair of {@code YYYY-MM-DD} dates for anything else.
 * All three become the same pair of days here, which is the only thing the queries below want to know, so nothing
 * past this class has to ask which of them was requested.
 *
 * <p>The third shape is here because this screen is read beside the reconciliation report, which has always taken an
 * arbitrary range, and a split whose two halves could not be set to the same span would be two screens rather than
 * one reading.
 */
@Getter
@RequiredArgsConstructor(access = AccessLevel.PRIVATE)
final class BankStatementPeriod {

    private final LocalDate from;
    private final LocalDate to;

    /**
     * The period a request named, either as a month or as a year.
     *
     * @throws IllegalArgumentException when it is neither, which the controller answers as a bad request
     */
    static BankStatementPeriod of(String period) {
        var stated = period == null ? "" : period.trim();
        try {
            // A year is the shorter of the two forms, so the length tells them apart before either is parsed and a
            // month is never read as a year whose separator was mistyped.
            if (stated.length() == 4) {
                var year = Year.parse(stated);
                return new BankStatementPeriod(year.atDay(1), year.atMonth(12).atEndOfMonth());
            }
            var month = YearMonth.parse(stated);
            return new BankStatementPeriod(month.atDay(1), month.atEndOfMonth());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("A period must be written as YYYY-MM or YYYY: " + period, e);
        }
    }

    /**
     * The span a request named as a pair of days, both ends included.
     *
     * @throws IllegalArgumentException when either end is not a date or the span runs backwards, which the
     *         controller answers as a bad request
     */
    static BankStatementPeriod between(String from, String to) {
        var firstDay = day(from, "from");
        var lastDay = day(to, "to");
        if (firstDay.isAfter(lastDay)) {
            throw new IllegalArgumentException("from must not be after to");
        }
        return new BankStatementPeriod(firstDay, lastDay);
    }

    private static LocalDate day(String stated, String name) {
        try {
            return LocalDate.parse(stated == null ? "" : stated.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(name + " must be written as YYYY-MM-DD: " + stated, e);
        }
    }
}
