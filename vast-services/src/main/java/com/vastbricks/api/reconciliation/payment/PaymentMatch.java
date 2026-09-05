package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.math.BigDecimal;
import java.util.List;

/**
 * Which of the orders a payment's buyer key named is the one it settled.
 *
 * <p>A buyer who ordered once is named outright. One who ordered several times in the month is told apart by what the
 * payment took: the payment states its amount and each order states what it came to, so within one buyer's own orders
 * that is an exact key rather than a guess. Only orders of one buyer that came to the same amount — or that carry no
 * amount to compare — stay ambiguous, and those leave every one of them unpaid, because a guessed payment would read
 * exactly like a reconciled one.
 *
 * <p>Both marketplace payment providers match a BrickLink order on a buyer, so the rule is stated here once.
 */
final class PaymentMatch {

    private PaymentMatch() {
    }

    /** The one order this payment settled, or {@code null} when neither the buyer nor the amount names exactly one. */
    static ReconciledOrder oneOf(List<ReconciledOrder> named, BigDecimal paidAmount) {
        if (named.size() == 1) {
            return named.getFirst();
        }
        var sameAmount = named.stream().filter(order -> cameTo(order, paidAmount)).toList();
        return sameAmount.size() == 1 ? sameAmount.getFirst() : null;
    }

    /** Whether the order came to exactly what the payment took. Amounts are normalized, so they compare exactly. */
    private static boolean cameTo(ReconciledOrder order, BigDecimal paidAmount) {
        return paidAmount != null
                && order.getGrandTotal() != null
                && order.getGrandTotal().compareTo(paidAmount) == 0;
    }
}
