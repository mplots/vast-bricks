package com.vastbricks.agentapp;

public class JobExecutionResult {
    private final boolean success;
    private final String message;
    private final byte[] pdfBytes;
    private final java.util.Map<String, String> meta;

    public JobExecutionResult(boolean success, String message, byte[] pdfBytes, java.util.Map<String, String> meta) {
        this.success = success;
        this.message = message;
        this.pdfBytes = pdfBytes;
        this.meta = meta;
    }

    public boolean isSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public byte[] getPdfBytes() {
        return pdfBytes;
    }

    public java.util.Map<String, String> getMeta() {
        return meta;
    }
}
