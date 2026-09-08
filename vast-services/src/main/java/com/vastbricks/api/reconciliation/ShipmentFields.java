package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

/**
 * What the shipping provider reports about the shipment sent for the order. A shipping mapper fills it in once it has
 * decided which order a shipment was sent for, so every field is {@code null} until then and stays {@code null} on an
 * order no shipment was matched to.
 *
 * <p>It is a source of its own rather than part of the order's account: the marketplace says what the buyer paid for
 * postage and the post office says what the postage cost, and holding one against the other is what the group is for
 * once both are collected.
 */
@Getter
@Setter
public class ShipmentFields {

    /**
     * What the shipping provider charged for the order's shipment: the postage with every additional service on it,
     * or {@code null} when no shipment was matched to the order.
     *
     * <p>An order shipped in several parcels states what all of them came to. Each parcel is a cost the store paid to
     * ship this one order, so the figure is what shipping it cost rather than what one of its parcels did.
     */
    private BigDecimal totalAmount;
}
