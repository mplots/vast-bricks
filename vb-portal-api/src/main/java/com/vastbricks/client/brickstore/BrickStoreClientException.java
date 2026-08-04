package com.vastbricks.client.brickstore;

public class BrickStoreClientException extends RuntimeException {
    public BrickStoreClientException(String message) {
        super(message);
    }

    public BrickStoreClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
