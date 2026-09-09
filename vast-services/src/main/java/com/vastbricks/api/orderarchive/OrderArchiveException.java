package com.vastbricks.api.orderarchive;

/** The archive could not be written, or has nowhere to be written to. */
class OrderArchiveException extends RuntimeException {

    OrderArchiveException(String message) {
        super(message);
    }

    OrderArchiveException(String message, Throwable cause) {
        super(message, cause);
    }
}
