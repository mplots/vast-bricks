package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.CALCULATED_MARKETPLACE_FEE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_MARKETPLACE_FEE;
import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.WARNING;

import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * What BrickOwl reports charging as its own commission should be what this store calculates the same commission as
 * from its published rate. The two are accounts of one charge from either side of it: BrickOwl's own
 * {@code brickowl_fee} and this store's independent working-out from the order's total, shipping and tax - built
 * for exactly this comparison, per "Order charges feature requirements".
 *
 * <p>The rule applies only to BrickOwl. BrickLink states no per-order fee at all, so {@code order.marketplaceFee} is
 * always absent for it and there is nothing reported to compare the calculation against.
 *
 * <p>A disagreement is a remark rather than something to fix: the calculation is known to approximate BrickOwl's own
 * rate card rather than reproduce it exactly, so a mismatch is worth a look without necessarily being wrong.
 *
 * <p>Compared only once both sides state an amount. Unlike a facilitator tax, where an order genuinely carries none
 * as often as it carries one, a real BrickOwl order is not expected to carry no commission at all; an order this
 * store cannot calculate a fee for, because it collected no order total, is not reported by BrickOwl reporting no
 * fee for it, and treating the two as agreeing on nothing would say more about what this run of imports happened to
 * collect than about the order.
 */
@Component
class RuleMarketplaceFeeMatchesCalculatedFee implements Rule {

    private static final String MARKETPLACE_FEE_MISMATCH = "marketplace-fee-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (!Marketplace.BRICK_OWL.equals(order.getOrder().getSource())) {
            return List.of();
        }

        var reported = order.getOrder().getMarketplaceFee();
        var calculated = order.getCalculated().getMarketplaceFee();
        if (reported == null || calculated == null || reported.compareTo(calculated) == 0) {
            return List.of();
        }
        return List.of(new ReconciliationFailure(
                MARKETPLACE_FEE_MISMATCH,
                WARNING,
                List.of(ORDER_MARKETPLACE_FEE, CALCULATED_MARKETPLACE_FEE)
        ));
    }
}
