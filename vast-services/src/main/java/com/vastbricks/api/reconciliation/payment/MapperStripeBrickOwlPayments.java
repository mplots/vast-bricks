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
import lombok.RequiredArgsConstructor;
import java.util.regex.Pattern;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges what Stripe took for a BrickOwl order onto that order. A transaction carries no order identifier of its own,
 * so the order number is read from the description BrickOwl gave the payment; that description is what decides the
 * match, which is why it is parsed here rather than in the source.
 */
@Component
@RequiredArgsConstructor
@Order(3)
class MapperStripeBrickOwlPayments implements DetailMapper<BalanceTransaction> {

    /** The order number inside a longer description, as BrickOwl words it: {@code Brick Owl Order #1600001}. */
    private static final Pattern BRICK_OWL_ORDER = Pattern.compile("\\bBrick Owl Order\\s+#?(\\S+)\\b");

    private final PaymentLinks paymentLinks;

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
            var orderId = orderId(transaction);
            if (orderId == null) {
                continue;
            }
            var paidAmount = StripePayments.paidAmount(transaction);
            for (var order : orders.find(Marketplace.BRICK_OWL, orderId)) {
                if (paid.add(order)) {
                    order.getGateway().setPaidAmount(paidAmount);
                    order.getGateway().setFeeAmount(StripePayments.feeAmount(transaction));
                    order.getGateway().setFacilitatorTax(StripePayments.facilitatorTax(transaction));
                    order.getGateway().setRefundedAmount(StripePayments.refundedAmount(transaction));
                    order.getGateway().setPaymentUrl(paymentLinks.stripe(StripePayments.paymentReference(transaction)));
                }
            }
        }
    }

    /** The BrickOwl order the description names, or {@code null} when it names none. */
    private String orderId(BalanceTransaction transaction) {
        var description = StripePayments.description(transaction);
        if (description == null) {
            return null;
        }
        var matcher = BRICK_OWL_ORDER.matcher(description);
        return matcher.find() ? matcher.group(1) : null;
    }
}
