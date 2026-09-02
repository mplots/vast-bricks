package com.vastbricks.api.invoice;

/** A request that cannot be turned into an invoice: an unknown source, or an order missing the data an invoice needs. */
class InvoiceException extends RuntimeException {

    InvoiceException(String message) {
        super(message);
    }

    InvoiceException(String message, Throwable cause) {
        super(message, cause);
    }
}
