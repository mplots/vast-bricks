package com.vastbricks.integration.bricklink;

public class LinkInternalClientException extends RuntimeException {
    public LinkInternalClientException(String message) {
        super(message);
    }

    public LinkInternalClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
