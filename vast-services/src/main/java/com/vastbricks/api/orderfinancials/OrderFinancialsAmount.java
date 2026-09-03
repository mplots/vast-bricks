package com.vastbricks.api.orderfinancials;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * Money arithmetic for derived financials. A derived amount keeps five decimals: it is an intermediate financial value
 * that later amounts are built on, so it is rounded once, here, rather than to the cent that a charged amount uses.
 */
final class OrderFinancialsAmount {

    private static final int SCALE = 5;
    private static final BigDecimal PERCENT = BigDecimal.valueOf(100);

    private OrderFinancialsAmount() {
    }

    static BigDecimal normalize(BigDecimal amount) {
        return amount == null ? null : amount.setScale(SCALE, RoundingMode.HALF_UP);
    }

    /** Removes tax already included in {@code amount}, charged at {@code taxRatePercent}. */
    static BigDecimal withoutTax(BigDecimal amount, BigDecimal taxRatePercent) {
        if (amount == null || taxRatePercent == null) {
            return null;
        }
        var taxMultiplier = BigDecimal.ONE.add(taxRatePercent.divide(PERCENT, MathContext.DECIMAL128));
        return normalize(amount.divide(taxMultiplier, MathContext.DECIMAL128));
    }
}
