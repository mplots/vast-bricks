package com.vastbricks.api.tor;

class TorCircuitException extends RuntimeException {

    public TorCircuitException(String message) {
        super(message);
    }

    public TorCircuitException(String message, Throwable cause) {
        super(message, cause);
    }
}
