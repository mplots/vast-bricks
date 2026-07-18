package com.vastbricks.bricksync;

public class BrickSyncCommandResponse {
    private final boolean accepted;
    private final String command;

    public BrickSyncCommandResponse(boolean accepted, String command) {
        this.accepted = accepted;
        this.command = command;
    }

    public boolean isAccepted() {
        return accepted;
    }

    public String getCommand() {
        return command;
    }
}
