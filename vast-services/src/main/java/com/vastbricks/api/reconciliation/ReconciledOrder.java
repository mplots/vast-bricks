package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * One item of the reconciled order list. An order mapper builds it and a detail mapper fills further fields in, so
 * it is mutable for the length of the mapping stage; that stage is single-threaded and the rule stage only reads.
 *
 * <p>The field order is the order the API exposes them in, because the result is serialized unwrapped.
 */
@Getter
@Setter
@Builder
public class ReconciledOrder {

    private String source;
    private String orderId;
    private LocalDate orderDate;
    private String buyer;
    private String buyerUsername;
    private BigDecimal subTotal;
    private BigDecimal itemsSubTotal;

    /** Sub-total of the accounting invoice for this order, or {@code null} when no invoice was found. */
    private BigDecimal invoiceSubTotal;
}
