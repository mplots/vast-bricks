package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Normalizes collected monetary amounts to the scale reconciliation rules compare on. Sources round once, so a rule
 * never has to define its own tolerance.
 */
final class ReconciliationAmount {

    private static final int SCALE = 2;

    private ReconciliationAmount() {
    }

    static BigDecimal normalize(BigDecimal value) {
        return value == null ? null : value.setScale(SCALE, RoundingMode.HALF_UP);
    }
}
