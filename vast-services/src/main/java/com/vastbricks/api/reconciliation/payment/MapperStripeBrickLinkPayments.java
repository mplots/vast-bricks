package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges what Stripe took for a BrickLink order onto that order. BrickLink names the buyer in the payment
 * description rather than the order, so the payment is matched on the buyer username; that makes this mapper depend
 * on the username the BrickLink username mapper merges, so it declares a later bean order than that one.
 *
 * <p>A username the month collected several orders for leaves all of them unpaid. Which of them the payment settled
 * is not knowable from the description, and a guessed amount would read exactly like a reconciled one.
 */
@Component
@Order(4)
class MapperStripeBrickLinkPayments implements DetailMapper<BalanceTransaction> {

    /** The buyer username, as BrickLink words it: {@code Payment for BrickLink from MrIntellectual}. */
    private static final Pattern BRICK_LINK_PAYMENT = Pattern.compile(
            "^Payment for BrickLink from (.+)$",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public Class<BalanceTransaction> type() {
        return BalanceTransaction.class;
    }

    @Override
    public void map(List<BalanceTransaction> sourced, ReconciledOrders orders) {
        // The first payment of an order wins: a later one does not overwrite what was already matched.
        Set<ReconciledOrder> paid = Collections.newSetFromMap(new IdentityHashMap<>());
        for (var transaction : sourced) {
            if (!StripePayments.paysForOrder(transaction)) {
                continue;
            }
            var username = buyerUsername(transaction);
            if (username == null) {
                continue;
            }
            var matched = orders.findByBuyerUsername(Marketplace.BRICK_LINK, username);
            if (matched.size() != 1) {
                continue;
            }
            var order = matched.getFirst();
            if (paid.add(order)) {
                order.setPaidAmount(StripePayments.paidAmount(transaction));
            }
        }
    }

    /** The buyer the description names, or {@code null} when it names none. */
    private String buyerUsername(BalanceTransaction transaction) {
        var description = StripePayments.description(transaction);
        if (description == null) {
            return null;
        }
        var matcher = BRICK_LINK_PAYMENT.matcher(description);
        return matcher.matches() ? matcher.group(1).trim() : null;
    }
}
