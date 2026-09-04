package com.vastbricks.api.reconciliation;

import java.util.List;

/**
 * Merges provider detail onto orders that were already collected. A detail mapper adds no orders, so sourced data
 * matching none is dropped: whether a missing record fails an order is a rule's decision, not a mapper's.
 */
public interface DetailMapper<T> extends Mapper<T> {

    void map(List<T> sourced, ReconciledOrders orders);
}
