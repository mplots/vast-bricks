package com.vastbricks.api.currencyrate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Converts an amount stated in another currency into euros, using the ECB's own daily rates.
 *
 * <p>The whole of this feature's public API. Everything else here - the entity, the sync, the job - is this class's
 * own implementation detail; a feature wanting a euro figure asks this rather than reading the table itself, exactly
 * as a feature wanting a shipping price reads a public service rather than the table behind it.
 */
@Component
@RequiredArgsConstructor
public class CurrencyRates {

    private final CurrencyRateRepository repository;

    /**
     * {@code amount}, stated in {@code currency}, converted to euros at the rate closest to {@code date}. An amount
     * already in euros - or one with no currency stated at all - is handed back unchanged, since there is nothing to
     * convert. Null where {@code amount} is null, and null where this table has never held a rate for {@code
     * currency}: a figure this cannot convert is answered as unknown rather than as the number it arrived in.
     *
     * <p>The rate used is the one the ECB published on or before {@code date}, which is what a published rate answers
     * for until the next one replaces it. A date older than this table's own history falls back to the earliest rate
     * held for the currency, rather than refusing to convert an order older than the sync's own history.
     */
    public BigDecimal toEur(BigDecimal amount, String currency, LocalDate date) {
        if (amount == null) {
            return null;
        }
        String code = currency == null ? null : currency.trim().toUpperCase(Locale.ROOT);
        if (code == null || code.isBlank() || code.equals("EUR")) {
            return amount;
        }
        BigDecimal rate = rateFor(code, date);
        return rate == null ? null : amount.divide(rate, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal rateFor(String currency, LocalDate date) {
        return repository.findFirstByCurrencyAndRateDateLessThanEqualOrderByRateDateDesc(currency, date)
                .or(() -> repository.findFirstByCurrencyOrderByRateDateAsc(currency))
                .map(CurrencyRate::getRate)
                .orElse(null);
    }
}
