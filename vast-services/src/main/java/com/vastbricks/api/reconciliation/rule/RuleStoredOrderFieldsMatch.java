package com.vastbricks.api.reconciliation.rule;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Reports every field the stored copy of an order disagrees with the marketplace's live account on.
 *
 * <p>The comparison itself is stated once in {@link RuleStoredOrderMatchesCollected}, field by field, so adding a
 * field to the orders table is one line there rather than a rule of its own.
 */
@Component
class RuleStoredOrderFieldsMatch implements Rule {

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        return RuleStoredOrderMatchesCollected.mismatches(order);
    }
}
