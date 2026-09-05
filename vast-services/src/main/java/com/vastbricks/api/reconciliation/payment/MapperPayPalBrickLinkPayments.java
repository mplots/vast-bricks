package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges what PayPal took for a BrickLink order onto that order. BrickLink labels the payment with its own checkout
 * id rather than the order id, so the payment names nothing the order can be looked up by and the buyer is what is
 * left to match on.
 *
 * <p>The buyer's name is tried first, against every name PayPal gives the payment: the marketplace order carries the
 * buyer's real name, which is what a payment is made under. Where no name matches — the two systems spell one person
 * differently often enough — the order is looked for by what it came to on the day it was placed. That last key is
 * weak, so it only counts when it finds exactly one order, and this mapper considers only orders BrickLink says were
 * paid through PayPal so a payment cannot be attached to an order settled another way.
 *
 * <p>A buyer who ordered several times in the month is told apart by what the payment took: the payment states its
 * amount and each order states what it came to, so within one buyer's own orders that is an exact key rather than a
 * guess. Only orders of one buyer that came to the same amount stay ambiguous, and those, like a name or an
 * amount-and-day several orders share, leave all of them unpaid: a guessed payment would read exactly like a
 * reconciled one.
 */
@Component
@Order(6)
class MapperPayPalBrickLinkPayments implements DetailMapper<PayPalTransaction> {

    @Override
    public Class<PayPalTransaction> type() {
        return PayPalTransaction.class;
    }

    @Override
    public void map(List<PayPalTransaction> sourced, ReconciledOrders orders) {
        // The first payment of an order wins: a later one does not overwrite what was already matched.
        Set<ReconciledOrder> paid = Collections.newSetFromMap(new IdentityHashMap<>());
        for (var transaction : sourced) {
            if (!PayPalPayments.paysForOrder(transaction)) {
                continue;
            }
            var order = matchedOrder(transaction, orders);
            if (order != null && paid.add(order)) {
                order.setPaidAmount(PayPalPayments.paidAmount(transaction));
            }
        }
    }

    /** The one order this payment settled, or {@code null} when no key names exactly one. */
    private ReconciledOrder matchedOrder(PayPalTransaction transaction, ReconciledOrders orders) {
        var paidAmount = PayPalPayments.paidAmount(transaction);

        for (var buyerName : PayPalPayments.buyerNames(transaction)) {
            var named = payPalOrders(orders.findByBuyer(Marketplace.BRICK_LINK, buyerName));
            if (named.size() == 1) {
                return named.getFirst();
            }
            if (!named.isEmpty()) {
                // The buyer is known, so the amount settles which of their orders it was, or nothing does.
                return PaymentMatch.oneOf(named, paidAmount);
            }
        }

        var sameValue = payPalOrders(orders.findByGrandTotalOn(
                Marketplace.BRICK_LINK,
                paidAmount,
                PayPalPayments.paymentDate(transaction)
        ));
        return sameValue.size() == 1 ? sameValue.getFirst() : null;
    }

    private List<ReconciledOrder> payPalOrders(List<ReconciledOrder> orders) {
        return orders.stream().filter(PayPalPayments.PAID_THROUGH_PAYPAL).toList();
    }
}
