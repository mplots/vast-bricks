package com.vastbricks.api.reconciliation;

import com.vastbricks.api.tax.OrderTaxType;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Getter;
import lombok.Setter;

/**
 * What the orders table holds for the order: the copy the import job stored out of the order archive.
 *
 * <p>A source like any other, and the reason it is one is that it is a second account of the same thing. Every
 * field here carries the name of an {@link OrderFields} field, exactly as the gateway's facilitator tax carries the
 * name of the marketplace's: one quantity claimed twice, which is what a rule holding them against each other is
 * for. Nothing else in reconciliation is stated twice by the same party - this is the marketplace's own account,
 * read live on one side and read off the archive the store kept on the other, and the two agreeing is the whole
 * question.
 *
 * <p>It is filled in by a detail mapper once it has found the stored row for a collected order, so every field is
 * {@code null} until then and stays {@code null} on an order nothing was stored for - which a rule of its own
 * reports, since it means the import has not caught up rather than that the order disagrees.
 */
@Getter
@Setter
public class StoredFields {

    /** Whether a row was found at all, which is what tells an order nothing was stored for from one stating nulls. */
    private boolean present;

    private LocalDate orderDate;
    private String buyer;
    private String buyerUsername;
    private Integer itemCount;
    private Integer lotCount;
    private String paymentMethod;
    private String currency;
    private OrderTaxType taxType;
    private BigDecimal facilitatorTax;
    private BigDecimal subTotal;
    private BigDecimal shippingCost;
    private BigDecimal grandTotal;
    private BigDecimal refundedAmount;
}
