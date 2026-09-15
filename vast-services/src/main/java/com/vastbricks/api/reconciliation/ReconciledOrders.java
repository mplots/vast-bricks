package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * The single reconciled order list while the mapping stage builds it. Order mappers append to it, detail mappers
 * look their data's order up in it, and the rule stage iterates it. Insertion order is the API response order.
 *
 * <p>This is the only place that knows how an order is matched across systems. A detail mapper is given one to look
 * its data's order up in, and every key it may look one up by is a method here rather than a scan of its own.
 */
public final class ReconciledOrders {

    private final List<ReconciledOrder> orders = new ArrayList<>();
    private final Map<String, List<ReconciledOrder>> byKey = new HashMap<>();

    void add(ReconciledOrder order) {
        orders.add(order);
        byKey.computeIfAbsent(key(order.getOrder().getSource(), order.getOrder().getOrderId()), ignored -> new ArrayList<>()).add(order);
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
        return matching(source, username, order -> order.getOrder().getBuyerUsername());
    }

    /**
     * Every collected order of this marketplace whose buyer is named the same, compared as {@link #comparable} does.
     * A payment usually names the buyer rather than the order, so the buyer's name is a match key of its own.
     */
    public List<ReconciledOrder> findByBuyer(String source, String buyer) {
        return matching(source, buyer, order -> order.getOrder().getBuyer());
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
                .filter(order -> source.equals(order.getOrder().getSource()))
                .filter(order -> order.getOrder().getGrandTotal() != null
                        && order.getOrder().getGrandTotal().compareTo(grandTotal) == 0)
                .filter(order -> orderDate.equals(order.getOrder().getOrderDate()))
                .toList();
    }

    /**
     * Every collected order whose order id this text names, of any marketplace. A bank transfer carries free text a
     * payer wrote rather than a field naming the order, and it names no marketplace either, so the text is searched
     * for the ids that were actually collected instead of the ids being guessed out of the text by their shape.
     *
     * <p>An id counts only as a whole token, bounded by a character that is neither a letter nor a digit or by an end
     * of the text, so "payment for order 16000010" does not name order {@code 1600001}. All matches are returned: a
     * text naming two collected orders is ambiguous, and a caller must treat that as naming none.
     */
    public List<ReconciledOrder> findNamedIn(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        var searched = text.toLowerCase();
        return orders.stream()
                .filter(order -> names(searched, order.getOrder().getOrderId()))
                .toList();
    }

    /** Whether the text carries this order id as a whole token. */
    private static boolean names(String searched, String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return false;
        }
        var named = orderId.trim().toLowerCase();
        for (var at = searched.indexOf(named); at >= 0; at = searched.indexOf(named, at + 1)) {
            if (bounded(searched, at - 1) && bounded(searched, at + named.length())) {
                return true;
            }
        }
        return false;
    }

    /** Whether the character at this position ends a token: past either end of the text, or not alphanumeric. */
    private static boolean bounded(String searched, int at) {
        return at < 0 || at >= searched.length() || !Character.isLetterOrDigit(searched.charAt(at));
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
                .filter(order -> source.equals(order.getOrder().getSource()))
                .filter(order -> matched.equals(comparable(collected.apply(order))))
                .toList();
    }

    /**
     * A name as it is compared: normalized as every collected name is, and lowercased on top of that, because the
     * systems spell one person's name with different casing as well as different spacing. {@code null} when there is
     * no name to compare.
     */
    private static String comparable(String name) {
        var normalized = ReconciliationText.normalize(name);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private static String key(String source, String orderId) {
        return source + '/' + orderId;
    }
}
