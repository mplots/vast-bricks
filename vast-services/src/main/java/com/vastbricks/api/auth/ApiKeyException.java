package com.vastbricks.api.auth;

/** A key the caller asked for that cannot be generated or revoked as asked. */
class ApiKeyException extends RuntimeException {

    ApiKeyException(String message) {
        super(message);
    }
}
