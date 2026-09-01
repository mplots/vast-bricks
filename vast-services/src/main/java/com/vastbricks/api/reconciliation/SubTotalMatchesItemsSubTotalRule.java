package com.vastbricks.api.reconciliation;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ITEMS_SUB_TOTAL;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.SUB_TOTAL;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * An order's sub-total must equal the sum of its item prices. Both amounts are normalized by their source, so they are
 * compared exactly.
 */
@Component
class SubTotalMatchesItemsSubTotalRule implements ReconciliationRule {

    private static final String AMOUNT_MISSING = "amount-missing";
    private static final String SUB_TOTAL_MISMATCH = "sub-total-mismatch";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciliationOrder order) {
        var subTotal = order.getSubTotal();
        var itemsSubTotal = order.getItemsSubTotal();

        if (subTotal == null) {
            return List.of(new ReconciliationFailure(AMOUNT_MISSING, List.of(SUB_TOTAL)));
        }
        if (itemsSubTotal == null) {
            return List.of(new ReconciliationFailure(AMOUNT_MISSING, List.of(ITEMS_SUB_TOTAL)));
        }
        if (subTotal.compareTo(itemsSubTotal) != 0) {
            return List.of(new ReconciliationFailure(SUB_TOTAL_MISMATCH, List.of(SUB_TOTAL, ITEMS_SUB_TOTAL)));
        }
        return List.of();
    }
}
