package com.vastbricks.api.reconciliation;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One reason an order failed reconciliation. It carries no display text: the code identifies the reason and the client
 * words it, interpolating the values of the listed fields.
 */
@Getter
@AllArgsConstructor
public class ReconciliationFailure {

    /** Stable reason code. One rule may report different codes. */
    private final String code;

    /** Fields the rule used, in the order the reason mentions them. */
    private final List<ReconciliationOrderField> fields;
}
