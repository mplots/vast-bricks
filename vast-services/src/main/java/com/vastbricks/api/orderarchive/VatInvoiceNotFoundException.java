package com.vastbricks.api.orderarchive;

/** An invoice posted for an order this store does not hold, which is the same answer as one it never imported. */
class VatInvoiceNotFoundException extends VatInvoiceException {

    VatInvoiceNotFoundException(String message) {
        super(message);
    }
}
