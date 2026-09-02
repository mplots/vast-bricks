package com.vastbricks.api.invoice;

import java.util.Arrays;
import java.util.Locale;

/**
 * Marketplace an invoice can be generated for. The key is the prefix of the invoice note an invoice is created with,
 * so it is also what reconciliation reads back when it matches an invoice to its order.
 */
enum InvoiceOrderMarketplace {

    BRICK_LINK("bricklink"),
    BRICK_OWL("brickowl");

    private final String key;

    InvoiceOrderMarketplace(String key) {
        this.key = key;
    }

    String key() {
        return key;
    }

    /**
     * Resolves the source as it is sent by a client. Spellings differ across screens: the accounting screen sends
     * {@code BrickLink} and {@code Brick Owl}, reconciliation labels the same marketplaces {@code BrickOwl}.
     */
    static InvoiceOrderMarketplace of(String source) {
        if (source == null || source.isBlank()) {
            throw new InvoiceException("source is required");
        }
        var normalized = source.trim().toLowerCase(Locale.ROOT).replace(" ", "").replace("_", "");
        return Arrays.stream(values())
                .filter(marketplace -> marketplace.key.equals(normalized))
                .findFirst()
                .orElseThrow(() -> new InvoiceException("Unsupported order source: " + source));
    }
}
