package com.vastbricks.shipping;

import org.springframework.http.HttpStatusCode;

public class LatvijasPastsApiException extends RuntimeException {
    private final HttpStatusCode statusCode;

    public LatvijasPastsApiException(String message) {
        super(message);
        this.statusCode = null;
    }

    public LatvijasPastsApiException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = null;
    }

    public LatvijasPastsApiException(HttpStatusCode statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public HttpStatusCode getStatusCode() {
        return statusCode;
    }
}
