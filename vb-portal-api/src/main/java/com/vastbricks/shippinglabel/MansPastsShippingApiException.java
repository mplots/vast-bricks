package com.vastbricks.shippinglabel;

import org.springframework.http.HttpStatusCode;

class MansPastsShippingApiException extends RuntimeException {
    private final HttpStatusCode statusCode;

    MansPastsShippingApiException(String message) {
        super(message);
        this.statusCode = null;
    }

    MansPastsShippingApiException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = null;
    }

    MansPastsShippingApiException(HttpStatusCode statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    HttpStatusCode getStatusCode() {
        return statusCode;
    }
}
