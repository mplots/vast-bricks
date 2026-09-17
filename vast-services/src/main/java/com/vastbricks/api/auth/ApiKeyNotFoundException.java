package com.vastbricks.api.auth;

/** A key the caller named that is not theirs, or not this store's, which are the same answer to them. */
class ApiKeyNotFoundException extends ApiKeyException {

    ApiKeyNotFoundException(String message) {
        super(message);
    }
}
