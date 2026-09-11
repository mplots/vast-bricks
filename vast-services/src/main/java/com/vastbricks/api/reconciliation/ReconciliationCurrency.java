package com.vastbricks.api.reconciliation;

import java.util.Locale;

/** Normalizes a marketplace's payment currency once, before the report and its filters read it. */
public final class ReconciliationCurrency {

    private ReconciliationCurrency() {
    }

    public static String normalize(String currency) {
        return currency == null || currency.isBlank() ? null : currency.trim().toUpperCase(Locale.ROOT);
    }
}
