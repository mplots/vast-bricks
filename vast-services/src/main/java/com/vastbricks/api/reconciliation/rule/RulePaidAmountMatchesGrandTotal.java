package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.GRAND_TOTAL;
import static com.vastbricks.api.reconciliation.rule.ReconciliationOrderField.PAID_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * An order paid through a payment provider must have been paid its grand total. The rule applies only to orders paid
 * through a provider payments are collected from: an order paid another way has nothing to compare against yet, and
 * holding it to an amount nobody collected would say more about the migration than about the order.
 *
 * <p>Only the comparison is made here. A missing paid amount is reported by the rule that requires one, and a missing
 * grand total by the rule that collected it, so neither is repeated here.
 */
@Component
class RulePaidAmountMatchesGrandTotal implements Rule {

    /** The payment providers payments are collected from, as the mapping unified their names. */
    private static final Set<String> COLLECTED_PROVIDERS = Set.of("Stripe", "PayPal");

    private static final String PAID_AMOUNT_MISMATCH = "paid-amount-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        // An immutable set rejects a null lookup, and an order may have been collected with no payment method.
        if (order.getPaymentMethod() == null || !COLLECTED_PROVIDERS.contains(order.getPaymentMethod())) {
            return List.of();
        }

        var paidAmount = order.getPaidAmount();
        var grandTotal = order.getGrandTotal();
        if (paidAmount != null && grandTotal != null && paidAmount.compareTo(grandTotal) != 0) {
            return List.of(new ReconciliationFailure(
                    PAID_AMOUNT_MISMATCH,
                    ReconciliationFailureLevel.ERROR,
                    List.of(PAID_AMOUNT, GRAND_TOTAL)
            ));
        }
        return List.of();
    }
}
