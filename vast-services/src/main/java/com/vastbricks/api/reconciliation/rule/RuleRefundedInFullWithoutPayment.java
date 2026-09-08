package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.GATEWAY_PAID_AMOUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_GRAND_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_REFUNDED_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * An order the marketplace says was refunded its whole grand total, that no payment was matched to, is reported so
 * it can be seen rather than merely be silent. Nothing is wrong with it: a payment provider that only reserved the
 * funds books no transaction at all when the reservation is cancelled instead of captured, so the order was refunded
 * without any money ever having moved, and there is nothing for a payment to be found under.
 *
 * <p>That is why it reads at {@code info} rather than as an error. The rules that would otherwise report it — the
 * one requiring a collected payment, which does not apply to an order with nothing left to invoice for — say nothing
 * about it, so without this rule the order would read as reconciled and a genuine refund of a payment that was taken
 * would look the same as one that never was.
 *
 * <p>The refund has to be the whole grand total. A partial refund on an order with no payment is a different fact:
 * money was returned that no payment shows was taken, which is still something to invoice for and is left to the
 * rules that hold the two sides of a payment against each other.
 */
@Component
class RuleRefundedInFullWithoutPayment implements Rule {

    private static final String REFUNDED_WITHOUT_PAYMENT = "refunded-without-payment";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getGateway().getPaidAmount() != null) {
            return List.of();
        }

        var refunded = order.getOrder().getRefundedAmount();
        var grandTotal = order.getOrder().getGrandTotal();
        if (refunded == null || grandTotal == null || refunded.compareTo(grandTotal) != 0) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                REFUNDED_WITHOUT_PAYMENT,
                ReconciliationFailureLevel.INFO,
                List.of(ORDER_REFUNDED_AMOUNT, ORDER_GRAND_TOTAL, GATEWAY_PAID_AMOUNT)
        ));
    }
}
