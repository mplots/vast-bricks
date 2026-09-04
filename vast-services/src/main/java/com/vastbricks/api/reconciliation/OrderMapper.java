package com.vastbricks.api.reconciliation;

import java.util.List;

/**
 * Adds orders to the reconciled list. Every order mapper runs before any detail mapper, and the order the order
 * mappers run in is the order the API returns.
 */
public interface OrderMapper<T> extends Mapper<T> {

    List<ReconciledOrder> map(List<T> sourced);
}
