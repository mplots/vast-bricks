package com.vastbricks.api.reconciliation;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ReconciliationFailure {

    /** Stable rule code, so a client can react to a specific failure without parsing the message. */
    private final String rule;

    private final String message;
}
