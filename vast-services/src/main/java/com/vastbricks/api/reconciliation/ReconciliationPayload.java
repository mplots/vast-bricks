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

        /** Present for compatibility when the caller selects a month. */
        private final String selectedMonth;
        private final String from;
        private final String to;

        /**
         * Every field an order carries and the source that stated it, in the order the orders expose them. It rides
         * with the orders rather than in an endpoint of its own: a client reads the roster to group and to label what
         * it is about to show, so a separate request would only let it show a month against a roster from before it.
         */
        private final List<ReconciliationFieldDescriptor> fields;

        private final List<ReconciliationOrderResult> orders;
    }

    /** One field of a reconciled order, named as the orders expose it and attributed to the source that stated it. */
    @Getter
    @AllArgsConstructor
    public static final class ReconciliationFieldDescriptor {

        private final String name;
        private final ReconciliationFieldSource source;

        static ReconciliationFieldDescriptor of(ReconciliationOrderField field) {
            return new ReconciliationFieldDescriptor(field.getName(), field.getSource());
        }
    }

    /**
     * A collected order together with its reconciliation verdict. The order's source groups are unwrapped into the
     * surrounding JSON object, so an order reads as its sources beside its failures rather than as a wrapper holding
     * both, while sources remain unable to produce a verdict themselves.
     */
    @Getter
    @AllArgsConstructor
    public static final class ReconciliationOrderResult {

        @JsonUnwrapped
        private final ReconciledOrder order;

        private final List<ReconciliationFailure> failures;
    }
}
