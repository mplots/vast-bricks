package com.vastbricks.api.invoice;

/** Small text helpers the marketplace order sources share when they pick the buyer identity out of an order. */
final class InvoiceOrderText {

    private InvoiceOrderText() {
    }

    static String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new InvoiceException(message);
        }
        return value.trim();
    }

    static String firstNotBlank(String... values) {
        for (var value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    static String fullName(String firstName, String lastName) {
        var name = ((firstName == null ? "" : firstName.trim()) + " " + (lastName == null ? "" : lastName.trim()))
                .trim();
        return name.isEmpty() ? null : name;
    }
}
