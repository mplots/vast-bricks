package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.FACILITATOR_TAX;
import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.PAID_FACILITATOR_TAX;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * What the marketplace reported collecting as tax facilitator must be what the payment shows it took. The two are
 * accounts of one charge from either side of it: the marketplace states what it charged the buyer under its own
 * registration, and the payment provider states what the marketplace deducted from the payment again. A disagreement
 * is tax that will be reported wrongly by whichever side is believed, so it reads as something to fix.
 *
 * <p>The rule applies only once a payment has been matched to the order, which is what gives the payment's side an
 * account at all. An order no payment was matched to is reported by the rule that requires one, so it is not failed
 * twice here.
 *
 * <p>Neither side collecting is the two agreeing. A side that collected while the other did not is a disagreement,
 * not missing data: an absent amount is that side saying no facilitator tax was taken, which the other side
 * contradicts by naming one.
 */
@Component
class RulePaidFacilitatorTaxMatchesFacilitatorTax implements Rule {

    private static final String FACILITATOR_TAX_MISMATCH = "facilitator-tax-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (order.getPaidAmount() == null) {
            return List.of();
        }

        var reported = order.getFacilitatorTax();
        var paid = order.getPaidFacilitatorTax();
        if (collectedNothing(reported) && collectedNothing(paid)) {
            return List.of();
        }
        if (reported != null && paid != null && reported.compareTo(paid) == 0) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                FACILITATOR_TAX_MISMATCH,
                ReconciliationFailureLevel.ERROR,
                List.of(FACILITATOR_TAX, PAID_FACILITATOR_TAX)
        ));
    }

    /** Whether this side reports no facilitator tax at all. A side that states zero took the same nothing. */
    private boolean collectedNothing(BigDecimal amount) {
        return amount == null || amount.signum() == 0;
    }
}
