package com.vastbricks.taxinvoice;

public record TaxInvoiceParseRequest(
    byte[] pdf,
    String filename,
    Long orderId
) {
}
