package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.PAID_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Every order must have been paid. An order with no paid amount fails however it was paid: a payment nobody collected
 * is a payment nobody can show was made, and the payment method only says where to go looking for it.
 */
@Component
class RulePaidAmountPresent implements Rule {

    private static final String AMOUNT_MISSING = "amount-missing";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getPaidAmount() != null) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                AMOUNT_MISSING,
                ReconciliationFailureLevel.ERROR,
                List.of(PAID_AMOUNT)
        ));
    }
}
