package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.CALCULATED_PAYMENT_FEE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.GATEWAY_FEE_AMOUNT;
import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.WARNING;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * What Stripe or PayPal shows it charged for taking the payment should be what this store calculates the same charge
 * as from the provider's own published rate. The two are accounts of one charge from either side of it: the
 * payment's own reported fee and this store's independent working-out from the payment method and grand total - built
 * for exactly this comparison, per "Order charges feature requirements".
 *
 * <p>The rule applies only to Stripe and PayPal. Neither a bank transfer nor any other payment method carries a
 * published rate to calculate from, so {@code calculated.paymentFee} is always absent for one and there is nothing to
 * compare the payment's own fee against.
 *
 * <p>The rule applies only once a payment has been matched to the order, which is what gives the payment's side an
 * account at all. An order no payment was matched to is reported by the rule that requires one, so it is not failed
 * twice here.
 *
 * <p>A disagreement is a remark rather than something to fix: the calculation is known to approximate the provider's
 * own rate card - it does not know a card's country, a currency conversion, or a volume discount the account may
 * have negotiated - so a mismatch is worth a look without necessarily being wrong.
 *
 * <p>Compared only once both sides state an amount. A real Stripe or PayPal transaction is not expected to cost
 * nothing to take, so an order the payment carries no fee for - only because this particular collection did not
 * gather one, not because the provider charged none - is not the same fact as the calculation coming to zero, and
 * treating the two as agreeing on nothing would say more about what was collected than about the payment.
 */
@Component
class RulePaymentFeeMatchesCalculatedFee implements Rule {

    /** The payment methods {@link com.vastbricks.api.charges.PaymentFees} calculates a rate for. */
    private static final Set<String> RATED_PROVIDERS = Set.of("Stripe", "PayPal");

    private static final String PAYMENT_FEE_MISMATCH = "payment-fee-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        // An immutable set rejects a null lookup, and an order may have been collected with no payment method.
        if (order.getGateway().getPaidAmount() == null
                || order.getOrder().getPaymentMethod() == null
                || !RATED_PROVIDERS.contains(order.getOrder().getPaymentMethod())) {
            return List.of();
        }

        var reported = order.getGateway().getFeeAmount();
        var calculated = order.getCalculated().getPaymentFee();
        if (reported == null || calculated == null || reported.compareTo(calculated) == 0) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                PAYMENT_FEE_MISMATCH,
                WARNING,
                List.of(GATEWAY_FEE_AMOUNT, CALCULATED_PAYMENT_FEE)
        ));
    }
}
