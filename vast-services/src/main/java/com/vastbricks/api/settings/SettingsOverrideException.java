package com.vastbricks.api.settings;

public class SettingsOverrideException extends RuntimeException {

    public SettingsOverrideException(String message) {
        super(message);
    }

    public SettingsOverrideException(String message, Throwable cause) {
        super(message, cause);
    }
}
