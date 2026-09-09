package com.vastbricks.api.job;

/** No job is registered under the code that was asked for. */
class UnknownJobException extends RuntimeException {

    UnknownJobException(String code) {
        super("No job is registered under the code " + code);
    }
}
