package com.vastbricks.api.setup;

public class SetupEncryptionException extends RuntimeException {

    public SetupEncryptionException(String message) {
        super(message);
    }

    public SetupEncryptionException(String message, Throwable cause) {
        super(message, cause);
    }
}
