package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder(toBuilder = true)
public class ReconciliationOrder {

    private final String source;
    private final String orderId;
    private final LocalDate orderDate;
    private final String buyer;
    private final String buyerUsername;
    private final BigDecimal subTotal;
    private final BigDecimal itemsSubTotal;

    /** Sub-total of the accounting invoice for this order, or {@code null} when no invoice was found. */
    private final BigDecimal invoiceSubTotal;
}
