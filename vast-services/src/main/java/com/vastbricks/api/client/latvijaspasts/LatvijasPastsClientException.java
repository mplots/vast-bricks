package com.vastbricks.api.client.latvijaspasts;

public class LatvijasPastsClientException extends RuntimeException {

    public LatvijasPastsClientException(String message) {
        super(message);
    }

    public LatvijasPastsClientException(String message, Throwable cause) {
        super(message, cause);
    }
}
