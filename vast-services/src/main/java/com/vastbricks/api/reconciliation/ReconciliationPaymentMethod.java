package com.vastbricks.api.reconciliation;

import java.util.Map;

/**
 * Unifies the payment method names the marketplaces use for one payment provider, so an order paid the same way reads
 * the same whichever marketplace it came from. BrickLink words it for a person ("Credit/Debit (Powered by Stripe)")
 * and BrickOwl as a code ("stripe"); both collect as {@code Stripe}.
 *
 * <p>A method no provider is known for is kept as the marketplace worded it rather than dropped or lumped together:
 * the screen must still show how the order was paid. Mappings normalize once, so a rule never matches on wording.
 */
public final class ReconciliationPaymentMethod {

    /** Unified name by the fragment a marketplace's wording contains, matched case-insensitively. */
    private static final Map<String, String> PROVIDERS = Map.of(
            "paypal", "PayPal",
            "stripe", "Stripe"
    );

    private ReconciliationPaymentMethod() {
    }

    public static String normalize(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return null;
        }
        var collected = paymentMethod.trim();
        var lowercase = collected.toLowerCase();
        return PROVIDERS.entrySet().stream()
                .filter(provider -> lowercase.contains(provider.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(collected);
    }
}
