package com.vastbricks.api.orderarchive;

/** A VAT invoice that was posted but cannot be filed as posted. */
class VatInvoiceException extends RuntimeException {

    VatInvoiceException(String message) {
        super(message);
    }
}
