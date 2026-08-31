package com.vastbricks.api.reconciliation;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ReconciliationOrder {

    private final String source;
    private final String orderId;
    private final String buyer;
    private final String buyerUsername;
}
