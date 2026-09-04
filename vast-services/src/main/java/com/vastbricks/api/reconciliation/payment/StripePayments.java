package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.Set;

/** What the Stripe payment mappers share: which transactions pay for an order, and what one paid. */
final class StripePayments {

    /**
     * Transaction types that are a buyer paying for an order. Stripe reports the same list with its own fees, its
     * marketplace application fees and its refunds; those say nothing about what an order was paid, so they are
     * sourced and left unmapped until requirements for them are supplied.
     */
    private static final Set<String> PAYMENT_TYPES = Set.of("charge", "payment");

    private StripePayments() {
    }

    static boolean paysForOrder(BalanceTransaction transaction) {
        return transaction.getType() != null && PAYMENT_TYPES.contains(transaction.getType().toLowerCase());
    }

    /** What the transaction took, gross of Stripe's fees, normalized like every other collected amount. */
    static BigDecimal paidAmount(BalanceTransaction transaction) {
        return transaction.getAmount() == null
                ? null
                : ReconciliationAmount.normalize(BigDecimal.valueOf(transaction.getAmount()).movePointLeft(2));
    }

    /** The transaction's description, or {@code null} when it carries none to match an order on. */
    static String description(BalanceTransaction transaction) {
        if (transaction.getDescription() == null || transaction.getDescription().isBlank()) {
            return null;
        }
        return transaction.getDescription().trim();
    }
}
