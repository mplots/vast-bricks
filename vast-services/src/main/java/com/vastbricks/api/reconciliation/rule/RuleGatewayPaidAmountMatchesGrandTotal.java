package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_GRAND_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.GATEWAY_PAID_AMOUNT;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * An order paid through a payment provider must have been paid its grand total. The rule applies only to orders paid
 * in a way payments are collected for: an order paid another way has nothing to compare against yet, and holding it
 * to an amount nobody collected would say more about the migration than about the order.
 *
 * <p>A bank transfer is compared like a card payment, against what the entries naming the order came to. An order a
 * buyer underpaid and then topped up therefore agrees, both transfers being money the store received, while one they
 * never topped up disagrees, which is the whole point of asking.
 *
 * <p>Only the comparison is made here. A missing paid amount is reported by the rule that requires one, and a missing
 * grand total by the rule that collected it, so neither is repeated here.
 */
@Component
class RuleGatewayPaidAmountMatchesGrandTotal implements Rule {

    /**
     * The ways of paying payments are collected for, as the mapping unified their names. A bank transfer is one of
     * them: the bank is the payment provider of an order settled that way, and its entries are collected under the
     * gateway source like a card provider's payments.
     */
    private static final Set<String> COLLECTED_PROVIDERS = Set.of("Stripe", "PayPal", "Bank Transfer");

    private static final String PAID_AMOUNT_MISMATCH = "paid-amount-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        // An immutable set rejects a null lookup, and an order may have been collected with no payment method.
        if (order.getOrder().getPaymentMethod() == null || !COLLECTED_PROVIDERS.contains(order.getOrder().getPaymentMethod())) {
            return List.of();
        }

        var paidAmount = order.getGateway().getPaidAmount();
        var grandTotal = order.getOrder().getGrandTotal();
        if (paidAmount != null && grandTotal != null && paidAmount.compareTo(grandTotal) != 0) {
            return List.of(new ReconciliationFailure(
                    PAID_AMOUNT_MISMATCH,
                    ReconciliationFailureLevel.ERROR,
                    List.of(GATEWAY_PAID_AMOUNT, ORDER_GRAND_TOTAL)
            ));
        }
        return List.of();
    }
}
