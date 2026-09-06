package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * What the marketplaces took back out of the month's PayPal payments as tax facilitator. A payment states the tax the
 * buyer paid, not who ends up owing it, so the payment alone cannot say whether the store charged the tax under its
 * own registration or the marketplace did. What separates the two is the taking back: PayPal books it as a partner
 * fee, a transaction of its own naming the payment it was deducted from, and only a marketplace collecting as
 * facilitator raises one.
 *
 * <p>That makes the partner fee PayPal's account of the same deduction Stripe reports as an application fee, which is
 * why it is read from the whole sourced month rather than from the transaction being mapped.
 */
final class PayPalPartnerFees {

    /**
     * The event code of a partner fee: what the marketplace took from the payment for itself. PayPal counts a
     * marketplace's own commission under the same code, so this is the facilitator tax only while the marketplaces
     * bill their selling fees separately, as both do. A commission bundled in would make the two sides of the tax
     * disagree, which is what the reconciliation rule reports.
     */
    private static final String PARTNER_FEE = "T0113";

    /** What was taken out of each payment, by the transaction id the fee names. */
    private final Map<String, BigDecimal> byPayment;

    private PayPalPartnerFees(Map<String, BigDecimal> byPayment) {
        this.byPayment = byPayment;
    }

    /**
     * Indexes the month's partner fees by the payment each was taken from. Fees naming one payment are summed, so a
     * deduction stated in several rows is not read as only part of itself.
     */
    static PayPalPartnerFees of(List<PayPalTransaction> sourced) {
        var byPayment = new HashMap<String, BigDecimal>();
        for (var transaction : sourced) {
            var info = transaction.getTransactionInfo();
            if (info == null || !PARTNER_FEE.equalsIgnoreCase(info.getTransactionEventCode())) {
                continue;
            }
            var payment = info.getPayPalReferenceId();
            var amount = info.getTransactionAmount() == null ? null : info.getTransactionAmount().getValue();
            if (payment == null || payment.isBlank() || amount == null) {
                continue;
            }
            byPayment.merge(payment.trim(), amount, BigDecimal::add);
        }
        return new PayPalPartnerFees(byPayment);
    }

    /**
     * What the marketplace took out of this payment as facilitator, normalized like every other collected amount, or
     * {@code null} when it raised no fee against it. Nothing taken is a different fact from taking zero, so a payment
     * no fee names is left absent rather than zeroed.
     *
     * <p>A fee is a debit, which PayPal states as a negative amount; what the marketplace took is its opposite.
     */
    BigDecimal takenFrom(PayPalTransaction payment) {
        var taken = byPayment.get(PayPalPayments.paymentReference(payment));
        return taken == null ? null : ReconciliationAmount.normalize(taken.negate());
    }
}
