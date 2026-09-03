package com.vastbricks.api.orderfinancials;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/** Every request and response body of the order financials feature. */
final class OrderFinancialsPayload {

    private OrderFinancialsPayload() {
    }

    /**
     * One order's financials. Amounts the marketplace itself reported and amounts this feature derived from them are
     * returned side by side and never merged, so a caller always knows which is which.
     */
    @Getter
    @AllArgsConstructor
    public static final class OrderFinancialsResponse {

        private final String source;
        private final String orderId;
        private final ReportedOrderFinancials reported;
        private final CalculatedOrderFinancials calculated;
    }

    /**
     * Financial amounts as the marketplace reports them. Nothing here is derived: a value is either what the source
     * sent or {@code null} when the source sent none.
     */
    @Getter
    @Builder
    public static final class ReportedOrderFinancials {

        /** Order total in the store's base currency, tax included. */
        private final BigDecimal baseOrderTotal;

        /** Tax rate the order was charged at, as a percentage. */
        private final BigDecimal taxRate;
    }

    /**
     * Financial amounts this feature derives from the reported ones. A value is {@code null} when the reported amounts
     * it needs are missing, so a calculated amount is never a substitute for a reported one.
     */
    @Getter
    public static final class CalculatedOrderFinancials {

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
}
