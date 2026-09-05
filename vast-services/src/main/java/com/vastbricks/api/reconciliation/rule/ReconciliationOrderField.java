package com.vastbricks.api.reconciliation.rule;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Every collected order field a rule may cite in a failure. The declared name is the order's API property name, so a
 * client can map a failure straight onto the value it already holds.
 */
@Getter
@RequiredArgsConstructor
enum ReconciliationOrderField {

    SOURCE("source"),
    ORDER_ID("orderId"),
    ORDER_DATE("orderDate"),
    BUYER("buyer"),
    BUYER_USERNAME("buyerUsername"),
    PAYMENT_METHOD("paymentMethod"),
    TAX_TYPE("taxType"),
    SUB_TOTAL("subTotal"),
    ITEMS_SUB_TOTAL("itemsSubTotal"),
    GRAND_TOTAL("grandTotal"),
    INVOICE_SUB_TOTAL("invoiceSubTotal"),
    PAID_AMOUNT("paidAmount");

    @JsonValue
    private final String name;
}
