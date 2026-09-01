package com.vastbricks.api.reconciliation;

import java.util.List;

/**
 * Checks one collected order and reports why its reconciliation failed. A rule that does not apply to an order, and a
 * rule the order satisfies, both report no failures. A rule that applies but is missing the data it needs fails the
 * order rather than staying silent.
 */
public interface ReconciliationRule {

    List<ReconciliationFailure> evaluate(ReconciliationOrder order);
}
