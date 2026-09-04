package com.vastbricks.api.reconciliation;

/**
 * Marketplace labels a collected order and its accounting invoice are matched on. Declared once so an order mapper
 * and a detail mapper cannot drift apart on the spelling.
 */
public final class Marketplace {

    public static final String BRICK_LINK = "BrickLink";
    public static final String BRICK_OWL = "BrickOwl";

    private Marketplace() {
    }
}
