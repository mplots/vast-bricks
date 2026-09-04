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
 * Merges what PayPal took for a BrickOwl order onto that order. BrickOwl labels the payment with the bare order
 * number, so the invoice id is the order id; that is an exact key and, unlike the payment's subject, is not worded in
 * the buyer's language.
 */
@Component
@Order(5)
class MapperPayPalBrickOwlPayments implements DetailMapper<PayPalTransaction> {

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
            var invoiceId = PayPalPayments.invoiceId(transaction);
            if (invoiceId == null) {
                continue;
            }
            var paidAmount = PayPalPayments.paidAmount(transaction);
            for (var order : orders.find(Marketplace.BRICK_OWL, invoiceId)) {
                if (PayPalPayments.PAID_THROUGH_PAYPAL.test(order) && paid.add(order)) {
                    order.setPaidAmount(paidAmount);
                }
            }
        }
    }
}
