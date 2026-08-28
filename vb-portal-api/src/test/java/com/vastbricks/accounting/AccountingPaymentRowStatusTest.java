package com.vastbricks.accounting;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountingPaymentRowStatusTest {
    private final AccountingPaymentMatcher matcher = new AccountingPaymentMatcher();

    @Test
    void marksPayPalAndStripeOrdersUnmatchedWhenNoTransactionsAreAvailable() {
        var payPalOrder = order("BrickLink", "PayPal");
        var stripeOrder = order("BrickLink", "Stripe");

        matcher.matchPayPal(List.of(payPalOrder), List.of());
        matcher.matchStripe(List.of(stripeOrder), List.of());

        assertTrue(payPalOrder.isUnmatchedOnlinePayment());
        assertTrue(stripeOrder.isUnmatchedOnlinePayment());
    }

    @Test
    void doesNotMarkBankTransfersUnmatchedDuringPayPalMatching() {
        var bankTransferOrder = order("Brick Owl", "Bank Transfer");

        matcher.matchPayPal(List.of(bankTransferOrder), List.of());

        assertNull(bankTransferOrder.getPaymentMatchStatus());
        assertTrue(bankTransferOrder.isBankTransfer());
        assertFalse(bankTransferOrder.isUnmatchedOnlinePayment());
    }

    @Test
    void doesNotHighlightMatchedOnlinePaymentsAsUnmatched() {
        var order = order("BrickLink", "PayPal");
        order.setPaymentMatchStatus("MATCHED");

        assertFalse(order.isUnmatchedOnlinePayment());
        assertFalse(order.isBankTransfer());
    }

    private AccountingOrder order(String source, String paymentMethod) {
        var order = new AccountingOrder(
                source,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
        order.setPaymentMethod(paymentMethod);
        return order;
    }
}
