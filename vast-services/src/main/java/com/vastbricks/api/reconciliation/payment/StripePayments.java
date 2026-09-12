package com.vastbricks.api.reconciliation.payment;

import com.stripe.model.BalanceTransaction;
import com.stripe.model.Charge;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.Set;

/**
 * What the Stripe payment mappers share: which transactions pay for an order, what one paid, what tax it took and
 * what has since been refunded out of it.
 */
final class StripePayments {

    /**
     * Transaction types that are a buyer paying for an order. Stripe reports the same list with its own fees, the
     * marketplace's application fees drawn as transactions of their own and its refunds; none of those says what an
     * order was paid, so they are sourced and left unmapped. An application fee deducted from a payment is another
     * matter: it belongs to that payment and is read below, as is what the payment has since been refunded, which
     * the paying transaction states for itself and no refund transaction has to be found for.
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
     * What Stripe charged for taking the payment, normalized like every other collected amount, or {@code null} when
     * it charged nothing.
     *
     * <p>Everything the transaction was charged except the marketplace's application fee: that one is the facilitator
     * tax going back to whoever owes it and is reported as such above, while the processing fee, and the VAT some
     * countries charge on it, are what taking the payment cost. Reading it as "the rest of the fee" rather than as
     * {@code stripe_fee} alone keeps a fee type Stripe adds later inside the total rather than silently outside it.
     */
    static BigDecimal feeAmount(BalanceTransaction transaction) {
        if (transaction.getFeeDetails() == null) {
            return null;
        }
        var fees = transaction.getFeeDetails().stream()
                .filter(fee -> !APPLICATION_FEE.equalsIgnoreCase(fee.getType()) && fee.getAmount() != null)
                .map(fee -> BigDecimal.valueOf(fee.getAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return fees.signum() == 0 ? null : ReconciliationAmount.normalize(fees.movePointLeft(2));
    }

    /**
     * What was refunded out of the payment, as a positive amount normalized like every other collected amount, or
     * {@code null} when nothing was refunded. It is read from the charge's own running total, which Stripe keeps
     * whole rather than per refund, so one partial refund, several of them and a full refund are all one figure.
     *
     * <p>That total is what the payment has been refunded to date, a refund made after the reconciled month
     * included, because what the store may still invoice for is what the payment is worth now rather than what it
     * was worth when it was taken.
     *
     * <p>The refund transactions of the month are deliberately not summed instead. Stripe dates a refund at itself
     * rather than at the charge it reverses, so the refunds inside a month's window are neither all of an order's
     * refunds nor only its; a refund for an older order arrives with no charge in the list to attach it to, and one
     * made a month later never arrives at all.
     */
    static BigDecimal refundedAmount(BalanceTransaction transaction) {
        if (!(transaction.getSourceObject() instanceof Charge charge)
                || charge.getAmountRefunded() == null
                || charge.getAmountRefunded() == 0L) {
            return null;
        }
        return ReconciliationAmount.normalize(BigDecimal.valueOf(charge.getAmountRefunded()).movePointLeft(2));
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
