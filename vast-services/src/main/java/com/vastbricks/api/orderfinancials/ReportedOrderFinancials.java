package com.vastbricks.api.orderfinancials;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

/**
 * Financial amounts as the marketplace reports them. Nothing here is derived: a value is either what the source sent or
 * {@code null} when the source sent none.
 */
@Getter
@Builder
public class ReportedOrderFinancials {

    /** Order total in the store's base currency, tax included. */
    private final BigDecimal baseOrderTotal;

    /** Tax rate the order was charged at, as a percentage. */
    private final BigDecimal taxRate;
}
