package com.vastbricks.api.reconciliation;

import lombok.Getter;
import lombok.Setter;

/**
 * What the store synchronization system holds for the order: whether it ever saw the order, and so whether the stock
 * the order took was taken off the store's other marketplace.
 *
 * <p>A source of its own rather than an account of the order, as the archive is. The marketplace, the payment
 * provider and the accounting system each state what the order came to; this states whether one more system acted on
 * it, which no other source can answer.
 *
 * <p>A detail mapper fills it in for the orders the synchronization holds a record of, so it stays {@code null} on
 * every other order. Whether that is a failure is a rule's decision.
 */
@Getter
@Setter
public class StoreSyncFields {

    /**
     * Whether BrickSync holds its own record of the order, or {@code null} where it holds none. It is only ever
     * {@code TRUE}: the synchronization is asked which orders it recorded, not whether it recorded a given one, so
     * an order it did not name is one it has no record of.
     */
    private Boolean order;
}
