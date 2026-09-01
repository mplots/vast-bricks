package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Every collected order field a rule may cite in a failure. The declared name is the order's API property name, so a
 * client can map a failure straight onto the value it already holds.
 */
@Getter
@RequiredArgsConstructor
public enum ReconciliationOrderField {

    SOURCE("source"),
    ORDER_ID("orderId"),
    BUYER("buyer"),
    BUYER_USERNAME("buyerUsername"),
    SUB_TOTAL("subTotal"),
    ITEMS_SUB_TOTAL("itemsSubTotal");

    @JsonValue
    private final String name;
}
