package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

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

    /**
     * Every collected order of this marketplace whose buyer username matches, compared as {@link #comparable} does.
     * A payment can name the buyer rather than the order, so this is a match key of its own; all matches are returned
     * so a caller can tell an unambiguous one from several.
     *
     * <p>The orders are scanned rather than looked up: the username is merged onto an order by a detail mapper after
     * the order was collected, so an index built when it was added would be stale.
     */
    public List<ReconciledOrder> findByBuyerUsername(String source, String username) {
        return matching(source, username, ReconciledOrder::getBuyerUsername);
    }

    /**
     * Every collected order of this marketplace whose buyer is named the same, compared as {@link #comparable} does.
     * A payment usually names the buyer rather than the order, so the buyer's name is a match key of its own.
     */
    public List<ReconciledOrder> findByBuyer(String source, String buyer) {
        return matching(source, buyer, ReconciledOrder::getBuyer);
    }

    /**
     * Every collected order of this marketplace that came to this amount on this day. It is the weakest key there
     * is — two orders of the same value on one day are indistinguishable by it — so it is meant as a last resort,
     * and a caller must treat several matches as none.
     */
    public List<ReconciledOrder> findByGrandTotalOn(String source, BigDecimal grandTotal, LocalDate orderDate) {
        if (source == null || grandTotal == null || orderDate == null) {
            return List.of();
        }
        return orders.stream()
                .filter(order -> source.equals(order.getSource()))
                .filter(order -> order.getGrandTotal() != null
                        && order.getGrandTotal().compareTo(grandTotal) == 0)
                .filter(order -> orderDate.equals(order.getOrderDate()))
                .toList();
    }

    List<ReconciledOrder> all() {
        return List.copyOf(orders);
    }

    private List<ReconciledOrder> matching(
            String source,
            String name,
            Function<ReconciledOrder, String> collected
    ) {
        var matched = comparable(name);
        if (source == null || matched == null) {
            return List.of();
        }
        return orders.stream()
                .filter(order -> source.equals(order.getSource()))
                .filter(order -> matched.equals(comparable(collected.apply(order))))
                .toList();
    }

    /**
     * A name as it is compared: trimmed, inner runs of whitespace collapsed, and lowercased, because the systems
     * spell one person's name with different casing and spacing. {@code null} when there is no name to compare.
     */
    private static String comparable(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private static String key(String source, String orderId) {
        return source + '/' + orderId;
    }
}
