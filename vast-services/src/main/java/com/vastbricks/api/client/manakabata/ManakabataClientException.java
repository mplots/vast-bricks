package com.vastbricks.api.client.manakabata;

public class ManakabataClientException extends RuntimeException {

    public ManakabataClientException(String message) {
        super(message);
    }

    public ManakabataClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
