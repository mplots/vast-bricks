package com.vastbricks.api.client.paypal;

public class PayPalClientException extends RuntimeException {

    public PayPalClientException(String message) {
        super(message);
    }

    public PayPalClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
