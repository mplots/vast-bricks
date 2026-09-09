package com.vastbricks.api.client.bricklink;

/** BrickLink's store API would not answer, or answered with something this client cannot read. */
public class BrickLinkClientException extends RuntimeException {

    public BrickLinkClientException(String message) {
        super(message);
    }

    public BrickLinkClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
