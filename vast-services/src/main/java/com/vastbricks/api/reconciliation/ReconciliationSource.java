package com.vastbricks.api.reconciliation;

/**
 * Marketplace labels a collected order and its accounting invoice are matched on. Declared once so an order source and
 * an invoice source cannot drift apart on the spelling.
 */
final class ReconciliationSource {

    static final String BRICK_LINK = "BrickLink";
    static final String BRICK_OWL = "BrickOwl";

    private ReconciliationSource() {
    }
}
