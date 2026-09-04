package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;

/**
 * Sourcing stage: one provider fetch for the month being reconciled. A source returns the provider's data as received,
 * assembled only as far as the provider's own protocol requires. It makes no reconciliation decision and normalizes
 * nothing; deciding what the data means is a mapper's work.
 *
 * <p>Implementations live in the reconciliation category they source for, so this boundary is part of the small API
 * the feature root declares for those packages.
 */
public interface Source<T> {

    /**
     * The class this source returns. It is the only thing a mapper is matched on, so exactly one source may return a
     * given class; the orchestrator rejects a second one when the application starts.
     */
    Class<T> type();

    List<T> fetch(YearMonth month);
}
