package com.vastbricks.api.orderarchive;

/**
 * The marketplace an order was placed on.
 *
 * <p>Part of the archive's public API rather than any reader's, because the archive is what names its files after a
 * marketplace: one directory holds both stores, and an order id says nothing about which of them issued it. A
 * feature reading the archive back tells whose order a file holds by the same {@link #prefix()} that wrote it, so
 * there is one place the spelling lives and no way for the two halves to drift apart.
 */
public enum OrderSource {

    BRICKLINK("bricklink"),
    BRICKOWL("brickowl");

    private final String prefix;

    OrderSource(String prefix) {
        this.prefix = prefix;
    }

    /** How this marketplace is spelled at the front of an archived file's name. */
    public String prefix() {
        return prefix;
    }
}
