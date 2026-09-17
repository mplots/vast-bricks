package com.vastbricks.api.order;

/** A VAT invoice that was posted but cannot be filed as posted. */
class VatInvoiceException extends RuntimeException {

    VatInvoiceException(String message) {
        super(message);
    }
}
