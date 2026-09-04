package com.vastbricks.api.client.stripe;

public class StripeClientException extends RuntimeException {

    public StripeClientException(String message) {
        super(message);
    }

    public StripeClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
