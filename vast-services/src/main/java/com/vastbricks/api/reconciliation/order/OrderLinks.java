package com.vastbricks.api.reconciliation.order;

/**
 * Where an order can be looked at in the marketplace's own interface. The screen shows the link on the order id, so
 * the order a row failed to reconcile is one click away from the row.
 *
 * <p>Each marketplace addresses an order by the same id the reconciled order was collected under, so nothing beyond
 * the id is needed and no marketplace has to be asked. Unlike a payment link, this needs no configuration and no
 * reference the mapping had to keep, so it is a plain derivation rather than a component.
 *
 * <p>Public because the orders screen shows the same link on the same id. Where an order lives is a fact about the
 * marketplace rather than about reconciling it, and two copies of these addresses would drift.
 */
public final class OrderLinks {

    /** The BrickLink order view, asked to show the checklist, the weight and what remains, as the store opens it. */
    private static final String BRICK_LINK_ORDER =
            "https://www.bricklink.com/orderDetail.asp?ID=%s&viewChk=Y&viewWeight=Y&viewRemain=Y";

    private static final String BRICK_OWL_ORDER = "https://www.brickowl.com/mystore/orders/history/%s";

    private OrderLinks() {
    }

    /** Where BrickLink shows this order, or {@code null} when the order was collected without an id. */
    public static String brickLink(String orderId) {
        return orderId == null ? null : BRICK_LINK_ORDER.formatted(orderId);
    }

    /** Where BrickOwl shows this order, or {@code null} when the order was collected without an id. */
    public static String brickOwl(String orderId) {
        return orderId == null ? null : BRICK_OWL_ORDER.formatted(orderId);
    }
}
