package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.stripe.model.Charge;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.Set;

/** What the Stripe payment mappers share: which transactions pay for an order, what one paid, and what tax it took. */
final class StripePayments {

    /**
     * Transaction types that are a buyer paying for an order. Stripe reports the same list with its own fees, the
     * marketplace's application fees drawn as transactions of their own and its refunds; those say nothing about what
     * an order was paid, so they are sourced and left unmapped until requirements for them are supplied. An
     * application fee deducted from a payment is another matter: it belongs to that payment and is read below.
     */
    private static final Set<String> PAYMENT_TYPES = Set.of("charge", "payment");

    /**
     * The fee type a marketplace takes its facilitator tax back under. The buyer pays the tax into the store's own
     * Stripe balance along with the rest of the order, so the marketplace, which owes it to the tax authority under
     * its own registration, deducts it again as the fee its Connect application earned. Stripe's own processing fee
     * is a {@code stripe_fee} on the same transaction and is not the marketplace's.
     */
    private static final String APPLICATION_FEE = "application_fee";

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

    /**
     * What the marketplace deducted from the payment as its application fee, normalized like every other collected
     * amount, or {@code null} when it deducted none. Stripe reports fees in minor units, positive when assessed, and
     * lists each separately, so the entries of that type are summed.
     *
     * <p>This is the payment's own account of what the marketplace took as tax facilitator. It is read as an amount
     * the marketplace deducted rather than as a tax Stripe named, because Stripe names it a fee; whether it agrees
     * with what the marketplace reported collecting is what the rule stage decides.
     */
    static BigDecimal facilitatorTax(BalanceTransaction transaction) {
        if (transaction.getFeeDetails() == null) {
            return null;
        }
        var applicationFees = transaction.getFeeDetails().stream()
                .filter(fee -> APPLICATION_FEE.equalsIgnoreCase(fee.getType()) && fee.getAmount() != null)
                .toList();
        if (applicationFees.isEmpty()) {
            return null;
        }
        var total = applicationFees.stream()
                .map(fee -> BigDecimal.valueOf(fee.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return ReconciliationAmount.normalize(total.movePointLeft(2));
    }

    /**
     * The payment this transaction settled, as Stripe's dashboard addresses one, or {@code null} when the
     * transaction names none. A charge made through a payment intent is addressed by that intent; one made without
     * is addressed by the charge itself, which is all the older payments have.
     */
    static String paymentReference(BalanceTransaction transaction) {
        if (transaction.getSourceObject() instanceof Charge charge && charge.getPaymentIntent() != null) {
            return charge.getPaymentIntent();
        }
        return transaction.getSource();
    }

    /** The transaction's description, or {@code null} when it carries none to match an order on. */
    static String description(BalanceTransaction transaction) {
        if (transaction.getDescription() == null || transaction.getDescription().isBlank()) {
            return null;
        }
        return transaction.getDescription().trim();
    }
}
