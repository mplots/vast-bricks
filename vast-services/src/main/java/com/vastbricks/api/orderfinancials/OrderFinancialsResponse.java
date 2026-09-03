package com.vastbricks.api.orderfinancials;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One order's financials. Amounts the marketplace itself reported and amounts this feature derived from them are
 * returned side by side and never merged, so a caller always knows which is which.
 */
@Getter
@AllArgsConstructor
class OrderFinancialsResponse {

    private final String source;
    private final String orderId;
    private final ReportedOrderFinancials reported;
    private final CalculatedOrderFinancials calculated;
}
