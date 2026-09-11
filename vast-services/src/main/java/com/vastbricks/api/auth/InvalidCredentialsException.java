package com.vastbricks.api.auth;

class InvalidCredentialsException extends RuntimeException {

    InvalidCredentialsException(String message) {
        super(message);
    }
}
