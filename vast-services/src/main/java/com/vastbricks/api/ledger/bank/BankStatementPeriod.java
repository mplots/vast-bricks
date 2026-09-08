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
 * <p>The screen reads one month at a time to write mappings against entries, and one year at a time to see what a
 * year came to, so the span is asked for as the shape it is: {@code YYYY-MM} for a month, {@code YYYY} for a year.
 * Both become the same pair of days here, which is the only thing the queries below want to know, so nothing past
 * this class has to ask which of the two was requested.
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
}
