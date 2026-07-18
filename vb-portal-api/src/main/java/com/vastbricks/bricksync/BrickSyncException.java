package com.vastbricks.bricksync;

import org.springframework.http.HttpStatus;

public class BrickSyncException extends RuntimeException {
    private final HttpStatus status;

    public BrickSyncException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
