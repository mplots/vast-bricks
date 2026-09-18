package com.vastbricks.api.client.ecb;

public class EcbClientException extends RuntimeException {

    public EcbClientException(String message) {
        super(message);
    }

    public EcbClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
