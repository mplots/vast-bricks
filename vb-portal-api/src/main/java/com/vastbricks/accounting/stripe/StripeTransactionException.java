package com.vastbricks.accounting.stripe;

public class StripeTransactionException extends RuntimeException {
    public StripeTransactionException(String message) {
        super(message);
    }

    public StripeTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
