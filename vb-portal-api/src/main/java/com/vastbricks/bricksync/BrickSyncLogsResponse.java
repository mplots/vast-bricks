package com.vastbricks.bricksync;

public class BrickSyncLogsResponse {
    private final String container;
    private final int tail;
    private final String logs;

    public BrickSyncLogsResponse(String container, int tail, String logs) {
        this.container = container;
        this.tail = tail;
        this.logs = logs;
    }

    public String getContainer() {
        return container;
    }

    public int getTail() {
        return tail;
    }

    public String getLogs() {
        return logs;
    }
}
