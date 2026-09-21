package com.vastbricks.api.currencyrate;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** A mapping's conversions, retaining the distinction between an absent amount and an unavailable conversion. */
@RequiredArgsConstructor
public class EuroAmounts {
    private final CurrencyRates rates;
    @Getter
    private boolean incomplete;

    public BigDecimal convert(BigDecimal amount, String currency, LocalDate date) {
        BigDecimal converted = rates.toEur(amount, currency, date);
        incomplete |= amount != null && converted == null;
        return converted;
    }
}
