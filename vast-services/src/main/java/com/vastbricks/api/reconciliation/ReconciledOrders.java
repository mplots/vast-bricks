package com.vastbricks.api.reconciliation;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The single reconciled order list while the mapping stage builds it. Order mappers append to it, detail mappers
 * look their data's order up in it, and the rule stage iterates it. Insertion order is the API response order.
 *
 * <p>This is the only place that knows how an order is matched across systems. A detail mapper is given one to look
 * its data's order up in, so {@link #find} is the only method the category packages see.
 */
public final class ReconciledOrders {

    private final List<ReconciledOrder> orders = new ArrayList<>();
    private final Map<String, List<ReconciledOrder>> byKey = new HashMap<>();

    void add(ReconciledOrder order) {
        orders.add(order);
        byKey.computeIfAbsent(key(order.getSource(), order.getOrderId()), ignored -> new ArrayList<>()).add(order);
    }

    void addAll(Collection<ReconciledOrder> added) {
        added.forEach(this::add);
    }

    /**
     * Every collected order with this marketplace and order id, in collection order. All matches are returned rather
     * than one, so detail that matches two collected orders reaches both instead of being silently dropped.
     */
    public List<ReconciledOrder> find(String source, String orderId) {
        return List.copyOf(byKey.getOrDefault(key(source, orderId), List.of()));
    }

    List<ReconciledOrder> all() {
        return List.copyOf(orders);
    }

    private static String key(String source, String orderId) {
        return source + '/' + orderId;
    }
}
