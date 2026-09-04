package com.vastbricks.api.reconciliation.rule;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * How loudly a failure asks to be dealt with. The level says nothing about the reason: one code always carries the
 * level its rule gives it, and the client only decides how prominently to show it.
 */
@Getter
@RequiredArgsConstructor
enum ReconciliationFailureLevel {

    /** Recorded, but not shown at all: the reason is worth reporting without asking anyone to act on it. */
    SILENT("silent"),

    /** Shown as a plain remark. */
    INFO("info"),

    /** Shown as something to look at. */
    WARNING("warning"),

    /** Shown as something to fix. */
    ERROR("error");

    @JsonValue
    private final String name;
}
