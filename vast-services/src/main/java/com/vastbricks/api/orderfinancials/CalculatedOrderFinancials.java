package com.vastbricks.api.orderfinancials;

import java.math.BigDecimal;
import lombok.Getter;

/**
 * Financial amounts this feature derives from the reported ones. A value is {@code null} when the reported amounts it
 * needs are missing, so a calculated amount is never a substitute for a reported one.
 */
@Getter
class CalculatedOrderFinancials {

    /** Order total in the store's base currency with the reported tax removed. */
    private final BigDecimal baseOrderTotalWithoutTax;

    private CalculatedOrderFinancials(BigDecimal baseOrderTotalWithoutTax) {
        this.baseOrderTotalWithoutTax = baseOrderTotalWithoutTax;
    }

    static CalculatedOrderFinancials of(ReportedOrderFinancials reported) {
        return new CalculatedOrderFinancials(
                OrderFinancialsAmount.withoutTax(reported.getBaseOrderTotal(), reported.getTaxRate())
        );
    }
}
