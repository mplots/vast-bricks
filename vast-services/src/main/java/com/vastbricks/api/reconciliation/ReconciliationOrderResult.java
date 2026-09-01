package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * A collected order together with its reconciliation verdict. The order fields are unwrapped into the surrounding JSON
 * object, so the response stays flat while sources remain unable to produce a verdict themselves.
 */
@Getter
@AllArgsConstructor
class ReconciliationOrderResult {

    @JsonUnwrapped
    private final ReconciliationOrder order;

    private final List<ReconciliationFailure> failures;
}
