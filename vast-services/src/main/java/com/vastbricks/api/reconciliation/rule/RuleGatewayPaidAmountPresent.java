package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.GATEWAY_PAID_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Every order there is something to invoice for must have been paid. An order with no paid amount fails however it
 * was paid: a payment nobody collected is a payment nobody can show was made, and the payment method only says where
 * to go looking for it.
 *
 * <p>An order with no target invoice is the exception, and the rule does not apply to it at all. Nothing being left
 * to invoice for is exactly the case where no payment is owed: an order the marketplace says was refunded in full
 * that no payment was matched to has nothing to show a payment for, and one with no grand total collected states no
 * amount a payment could have been made of.
 */
@Component
class RuleGatewayPaidAmountPresent implements Rule {

    private static final String AMOUNT_MISSING = "amount-missing";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getGateway().getPaidAmount() != null || order.getCalculated().getTargetInvoice() == null) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                AMOUNT_MISSING,
                ReconciliationFailureLevel.ERROR,
                List.of(GATEWAY_PAID_AMOUNT)
        ));
    }
}
