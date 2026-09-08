package com.vastbricks.api.client.manspasts;

public class MansPastsClientException extends RuntimeException {

    public MansPastsClientException(String message) {
        super(message);
    }

    public MansPastsClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
