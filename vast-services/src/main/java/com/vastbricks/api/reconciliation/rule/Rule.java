package com.vastbricks.api.reconciliation.rule;

import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.List;

/**
 * Rule stage: checks one collected order and reports why its reconciliation failed. A rule that does not apply to an
 * order, and a rule the order satisfies, both report no failures. A rule that applies but is missing the data it needs
 * fails the order rather than staying silent.
 *
 * <p>A rule reasons across categories, so every rule lives in this package rather than under the category of any one
 * field it reads.
 */
public interface Rule {

    List<ReconciliationFailure> evaluate(ReconciledOrder order);
}
