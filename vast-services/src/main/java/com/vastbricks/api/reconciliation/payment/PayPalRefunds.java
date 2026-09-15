package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * What came back out of the month's PayPal payments. A PayPal payment states what it took and never what has since
 * been returned, so a refund is a transaction of its own naming the payment it reverses; that is the opposite of
 * Stripe, which keeps a running refunded total on the charge itself and needs no refund transaction found for it.
 *
 * <p>That makes the refund read from the whole sourced month rather than from the transaction being mapped, which is
 * the same shape {@link PayPalPartnerFees} reads a facilitator tax in.
 *
 * <p>It follows that a refund is only collected while it falls inside the window the month's transactions were
 * searched in, because PayPal dates a refund at itself rather than at the payment it reverses. A payment refunded
 * long after the month it was taken in therefore still reads as unrefunded here, and the rule holding the two sides
 * of a refund against each other reports it as the disagreement it is. Refunds are ordinarily raised within days of
 * the payment — a marketplace refunds an order it could not ship — so the padded window holds them; making the
 * late one collectable would mean asking PayPal for a second window around the refunds themselves, which is a
 * separate fetch and not what this reads.
 */
final class PayPalRefunds {

    /**
     * The event code of a refund the merchant made: money returned to the buyer out of a payment. PayPal books what
     * it reverses itself, a dispute lost and a chargeback under codes of their own; none of those is the marketplace
     * telling the buyer it refunded the order, so they are sourced and left unmapped rather than summed in here,
     * where they would make the payment's side of a refund disagree with the marketplace's on orders no marketplace
     * ever refunded.
     */
    private static final String PAYMENT_REFUND = "T1107";

    /** What came back out of each payment, by the transaction id the refund names. */
    private final Map<String, BigDecimal> byPayment;

    private PayPalRefunds(Map<String, BigDecimal> byPayment) {
        this.byPayment = byPayment;
    }

    /**
     * Indexes the month's refunds by the payment each was taken out of. Refunds naming one payment are summed, so an
     * order refunded in parts twice is read as what came back altogether rather than as the last part of it.
     */
    static PayPalRefunds of(List<PayPalTransaction> sourced) {
        var byPayment = new HashMap<String, BigDecimal>();
        for (var transaction : sourced) {
            var info = transaction.getTransactionInfo();
            if (info == null || !PAYMENT_REFUND.equalsIgnoreCase(info.getTransactionEventCode())) {
                continue;
            }
            var payment = info.getPayPalReferenceId();
            var amount = info.getTransactionAmount() == null ? null : info.getTransactionAmount().getValue();
            if (payment == null || payment.isBlank() || amount == null) {
                continue;
            }
            byPayment.merge(payment.trim(), amount, BigDecimal::add);
        }
        return new PayPalRefunds(byPayment);
    }

    /**
     * What came back out of this payment, as a positive amount normalized like every other collected amount, or
     * {@code null} when nothing was refunded against it. Nothing refunded is a different fact from refunding zero, so
     * a payment no refund names is left absent rather than zeroed.
     *
     * <p>A refund leaves the balance, which PayPal states as a negative amount; what came back to the buyer is its
     * opposite.
     */
    BigDecimal refundedFrom(PayPalTransaction payment) {
        var refunded = byPayment.get(PayPalPayments.paymentReference(payment));
        return refunded == null ? null : ReconciliationAmount.normalize(refunded.negate());
    }
}
