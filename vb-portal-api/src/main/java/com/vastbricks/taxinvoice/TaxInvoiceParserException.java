package com.vastbricks.taxinvoice;

public class TaxInvoiceParserException extends RuntimeException {
    public TaxInvoiceParserException(String message) {
        super(message);
    }

    public TaxInvoiceParserException(String message, Throwable cause) {
        super(message, cause);
    }
}
