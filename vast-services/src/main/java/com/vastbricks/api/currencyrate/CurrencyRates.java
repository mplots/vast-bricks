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

    /** Converts with the latest rate published on or before the amount's date; missing history is unknown. */
    public BigDecimal toEur(BigDecimal amount, String currency, LocalDate date) {
        BigDecimal converted = convertUnrounded(amount, currency, "EUR", date);
        return converted == null ? null : converted.setScale(2, RoundingMode.HALF_UP);
    }

    /** Retains precision for calculations such as applying a USD fee schedule before rounding the final EUR fee. */
    public BigDecimal convertUnrounded(BigDecimal amount, String from, String to, LocalDate date) {
        if (amount == null) return null;
        String source = normalize(from);
        String target = normalize(to);
        if (source == null || target == null) return null;
        if (source.equals(target)) return amount;
        BigDecimal sourceRate = rateFor(source, date);
        BigDecimal targetRate = rateFor(target, date);
        if (sourceRate == null || targetRate == null) return null;
        return amount.multiply(targetRate).divide(sourceRate, java.math.MathContext.DECIMAL128);
    }

    private static String normalize(String currency) {
        return currency == null || currency.isBlank() ? null : currency.trim().toUpperCase(Locale.ROOT);
    }

    private BigDecimal rateFor(String currency, LocalDate date) {
        if ("EUR".equals(currency)) return BigDecimal.ONE;
        if (date == null) return null;
        return repository.findFirstByCurrencyAndRateDateLessThanEqualOrderByRateDateDesc(currency, date)
                .map(CurrencyRate::getRate)
                .filter(rate -> rate.signum() > 0)
                .orElse(null);
    }
}
