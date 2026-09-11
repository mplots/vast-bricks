package com.vastbricks.api.auth;

class NoTenantAvailableException extends RuntimeException {

    NoTenantAvailableException(String message) {
        super(message);
    }
}
