package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import com.vastbricks.api.reconciliation.rule.ReconciliationFailure;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Every request and response body of the reconciliation feature. */
final class ReconciliationPayload {

    private ReconciliationPayload() {
    }

    @Getter
    @AllArgsConstructor
    public static final class ReconciliationOrdersResponse {

        private final String selectedMonth;
        private final List<ReconciliationOrderResult> orders;
    }

    /**
     * A collected order together with its reconciliation verdict. The order fields are unwrapped into the surrounding
     * JSON object, so the response stays flat while sources remain unable to produce a verdict themselves.
     */
    @Getter
    @AllArgsConstructor
    public static final class ReconciliationOrderResult {

        @JsonUnwrapped
        private final ReconciledOrder order;

        private final List<ReconciliationFailure> failures;
    }
}
