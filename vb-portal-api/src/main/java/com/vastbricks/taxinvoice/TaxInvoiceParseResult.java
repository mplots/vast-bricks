package com.vastbricks.taxinvoice;

public record TaxInvoiceParseResult(
    String taxId,
    String invoiceNumber
) {
}
