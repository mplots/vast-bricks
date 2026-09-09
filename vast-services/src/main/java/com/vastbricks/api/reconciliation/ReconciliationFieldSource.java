package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Where a reconciled order's field came from. Reconciliation is the business of holding several accounts of one order
 * against each other, so what a field is worth means little without knowing which account stated it: the same amount
 * named by the marketplace and by the payment provider is two claims, and a rule comparing them is comparing sources
 * rather than numbers.
 *
 * <p>It is declared once here and reported with the field roster, so a reader is told the source rather than left to
 * infer it from a field's name, and a client groups the fields by it instead of keeping a list of its own.
 */
@Getter
@RequiredArgsConstructor
public enum ReconciliationFieldSource {

    /** What the marketplace reported about the order itself. */
    ORDER("order"),

    /** What the payment provider reports about the payment matched to the order. */
    GATEWAY("gateway"),

    /** What the shipping provider reports about the shipment sent for the order. */
    SHIPMENT("shipment"),

    /** What the accounting system holds for the order: the invoice that was written for it. */
    ACCOUNTING("accounting"),

    /** Derived from the collected fields rather than stated by anyone. */
    CALCULATED("calculated");

    @JsonValue
    private final String name;
}
