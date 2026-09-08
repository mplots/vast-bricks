package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.GATEWAY_REFUNDED_AMOUNT;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_REFUNDED_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * What the marketplace reports was refunded on the order must be what the payment shows came back out of it. The two
 * are accounts of one refund from either side of it: the marketplace states what it told the buyer was returned, and
 * the payment provider states what actually left the store's balance. A disagreement is an order that will be
 * invoiced for the wrong amount by whichever side is believed, so it reads as an `error` exactly as the facilitator
 * tax does.
 *
 * <p>The marketplace's side is only partly collected, so this rule still fails orders a payment shows a refund on.
 * That is deliberate rather than premature: the failure is the standing report of which orders have a refund no
 * marketplace mapping accounts for, and it goes quiet order by order as each one's refund is collected. BrickOwl
 * states a refund total on the order itself, so its side is collected in full. BrickLink names no refund in its
 * export, so it is collected from the order detail page of every cancelled order and of no other; a refund on an
 * order of another status stays reported here.
 *
 * <p>The rule applies only once a payment has been matched to the order, which is what gives the payment's side an
 * account at all. An order no payment was matched to is reported by the rule that requires one, so it is not failed
 * twice here.
 *
 * <p>Neither side reporting a refund is the two agreeing, which is what leaves the ordinary order — refunded by
 * nobody — silent. A side reporting one where the other did not is a disagreement rather than missing data: an
 * absent amount is that side saying nothing came back, which the other side contradicts by naming an amount.
 */
@Component
class RuleGatewayRefundedAmountMatchesRefundedAmount implements Rule {

    private static final String REFUNDED_AMOUNT_MISMATCH = "refunded-amount-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getGateway().getPaidAmount() == null) {
            return List.of();
        }

        var reported = order.getOrder().getRefundedAmount();
        var refunded = order.getGateway().getRefundedAmount();
        if (refundedNothing(reported) && refundedNothing(refunded)) {
            return List.of();
        }
        if (reported != null && refunded != null && reported.compareTo(refunded) == 0) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                REFUNDED_AMOUNT_MISMATCH,
                ReconciliationFailureLevel.ERROR,
                List.of(ORDER_REFUNDED_AMOUNT, GATEWAY_REFUNDED_AMOUNT)
        ));
    }

    /** Whether this side reports no refund at all. A side that states zero returned the same nothing. */
    private boolean refundedNothing(BigDecimal amount) {
        return amount == null || amount.signum() == 0;
    }
}
