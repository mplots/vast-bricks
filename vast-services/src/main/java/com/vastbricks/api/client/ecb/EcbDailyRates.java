package com.vastbricks.api.client.ecb;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import lombok.Getter;

/** One day's euro reference rates, exactly as the ECB published them. */
@Getter
public class EcbDailyRates {

    private final LocalDate rateDate;

    /** How much of each currency one euro bought on {@link #rateDate}, keyed by its ISO 4217 code. */
    private final Map<String, BigDecimal> rates;

    EcbDailyRates(LocalDate rateDate, Map<String, BigDecimal> rates) {
        this.rateDate = rateDate;
        this.rates = rates;
    }
}
