package com.vastbricks.api.reconciliation;

import java.util.Map;

/**
 * Unifies the payment method names the marketplaces use for one payment provider, so an order paid the same way reads
 * the same whichever marketplace it came from. BrickLink words it for a person ("Credit/Debit (Powered by Stripe)")
 * and BrickOwl as a code ("stripe"); both collect as {@code Stripe}. A bank transfer is the same story with no
 * provider behind it: BrickLink's "Bank Transfer" and BrickOwl's "bank" both collect as {@code Bank Transfer}.
 *
 * <p>A method no provider is known for is kept as the marketplace worded it rather than dropped or lumped together:
 * the screen must still show how the order was paid. Mappings normalize once, so a rule never matches on wording.
 */
public final class ReconciliationPaymentMethod {

    /**
     * The unified name by the fragment a marketplace's wording contains, matched case-insensitively. Fragments do
     * not overlap, so the map needs no order to be unambiguous.
     */
    private static final Map<String, String> UNIFIED_NAMES = Map.of(
            "paypal", "PayPal",
            "stripe", "Stripe",
            "bank", "Bank Transfer"
    );

    private ReconciliationPaymentMethod() {
    }

    public static String normalize(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return null;
        }
        var collected = paymentMethod.trim();
        var lowercase = collected.toLowerCase();
        return UNIFIED_NAMES.entrySet().stream()
                .filter(unified -> lowercase.contains(unified.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(collected);
    }
}
