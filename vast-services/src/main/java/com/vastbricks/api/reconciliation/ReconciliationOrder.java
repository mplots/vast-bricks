package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ReconciliationOrder {

    private final String source;
    private final String orderId;
    private final String buyer;
    private final String buyerUsername;
    private final BigDecimal subTotal;
    private final BigDecimal itemsSubTotal;
}
