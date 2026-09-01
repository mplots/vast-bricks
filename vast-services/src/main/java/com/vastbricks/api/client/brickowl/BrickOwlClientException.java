package com.vastbricks.api.client.brickowl;

public class BrickOwlClientException extends RuntimeException {

    public BrickOwlClientException(String message) {
        super(message);
    }

    public BrickOwlClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
