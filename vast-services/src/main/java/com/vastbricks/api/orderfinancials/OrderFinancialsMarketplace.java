package com.vastbricks.api.orderfinancials;

import java.util.Arrays;
import java.util.Locale;

/** Marketplace an order's financials can be collected from. The label is what the API reports back. */
enum OrderFinancialsMarketplace {

    BRICK_OWL("brickowl", "BrickOwl");

    private final String key;
    private final String label;

    OrderFinancialsMarketplace(String key, String label) {
        this.key = key;
        this.label = label;
    }

    String label() {
        return label;
    }

    /** Resolves the source as it is sent by a client, whose spelling differs per screen: {@code Brick Owl}, {@code BrickOwl}. */
    static OrderFinancialsMarketplace of(String source) {
        if (source == null || source.isBlank()) {
            throw new OrderFinancialsException("source is required");
        }
        var normalized = source.trim().toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
        return Arrays.stream(values())
                .filter(marketplace -> marketplace.key.equals(normalized))
                .findFirst()
                .orElseThrow(() -> new OrderFinancialsException("Unsupported order source: " + source));
    }
}
