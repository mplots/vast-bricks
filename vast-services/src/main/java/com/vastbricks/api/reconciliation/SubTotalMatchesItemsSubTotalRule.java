package com.vastbricks.api.reconciliation;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * An order's sub-total must equal the sum of its item prices. Both amounts are normalized by their source, so they are
 * compared exactly.
 */
@Component
class SubTotalMatchesItemsSubTotalRule implements ReconciliationRule {

    private static final String RULE = "subTotalMatchesItemsSubTotal";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciliationOrder order) {
        var subTotal = order.getSubTotal();
        var itemsSubTotal = order.getItemsSubTotal();

        if (subTotal == null) {
            return List.of(failure("Order sub-total is missing."));
        }
        if (itemsSubTotal == null) {
            return List.of(failure("Items sub-total is missing."));
        }
        if (subTotal.compareTo(itemsSubTotal) != 0) {
            return List.of(failure("Order sub-total %s does not match the items sub-total %s."
                    .formatted(subTotal.toPlainString(), itemsSubTotal.toPlainString())));
        }
        return List.of();
    }

    private ReconciliationFailure failure(String message) {
        return new ReconciliationFailure(RULE, message);
    }
}
