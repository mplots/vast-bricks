package com.vastbricks.api.bricksync;

/** BrickSync's own data could not be read. */
public class BrickSyncException extends RuntimeException {

    public BrickSyncException(String message, Throwable cause) {
        super(message, cause);
    }

    public BrickSyncException(String message) {
        super(message);
    }
}
