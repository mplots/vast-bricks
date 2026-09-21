package com.vastbricks.api.charges;

import com.vastbricks.api.currencyrate.CurrencyRates;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Applies BrickLink's USD thresholds in USD and reports the calculated commission in EUR. */
@Component
@RequiredArgsConstructor
public class MarketplaceFeeAmounts {
    private final CurrencyRates rates;

    public BigDecimal brickLinkInEur(BigDecimal total, String currency, LocalDate date) {
        BigDecimal dollars = rates.convertUnrounded(total, currency, "USD", date);
        return rates.toEur(MarketplaceFees.brickLinkOf(dollars), "USD", date);
    }
}
