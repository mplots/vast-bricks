package com.vastbricks.accounting.paypal;

public class PayPalTransactionException extends RuntimeException {
    public PayPalTransactionException(String message) {
        super(message);
    }

    public PayPalTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
