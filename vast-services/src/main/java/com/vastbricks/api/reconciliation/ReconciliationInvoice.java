package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One accounting invoice, reduced to what reconciliation needs: the order it belongs to and its sub-total.
 */
@Getter
@AllArgsConstructor
public class ReconciliationInvoice {

    /** Marketplace the invoiced order came from, matching the collected order's source. */
    private final String source;

    private final String orderId;

    private final BigDecimal subTotal;
}
