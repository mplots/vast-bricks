package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.INFO;

import java.util.List;
import lombok.Getter;

/**
 * One reason an order failed reconciliation. It carries no display text: the code identifies the reason and the client
 * words it, interpolating the values of the listed fields. The level is how loudly the client should say it.
 */
@Getter
public class ReconciliationFailure {

    /** Stable reason code. One rule may report different codes. */
    private final String code;

    /** How prominently the client shows this failure. */
    private final ReconciliationFailureLevel level;

    /** Fields the rule used, in the order the reason mentions them. */
    private final List<ReconciliationOrderField> fields;

    ReconciliationFailure(String code, ReconciliationFailureLevel level, List<ReconciliationOrderField> fields) {
        this.code = code;
        this.level = level;
        this.fields = fields;
    }

    /** A failure at the default level, for a rule that has no reason to raise or lower its voice. */
    ReconciliationFailure(String code, List<ReconciliationOrderField> fields) {
        this(code, INFO, fields);
    }
}
