package com.vastbricks.api.setup.settings;

public class SettingsOverrideException extends RuntimeException {

    public SettingsOverrideException(String message) {
        super(message);
    }

    public SettingsOverrideException(String message, Throwable cause) {
        super(message, cause);
    }
}
