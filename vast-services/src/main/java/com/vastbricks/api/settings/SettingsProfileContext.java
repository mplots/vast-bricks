package com.vastbricks.api.settings;

import java.util.Optional;

public final class SettingsProfileContext {

    private static final ThreadLocal<String> CURRENT_PROFILE = new ThreadLocal<>();

    private SettingsProfileContext() {
    }

    public static Optional<String> currentProfile() {
        return Optional.ofNullable(CURRENT_PROFILE.get());
    }

    static void setProfile(String profile) {
        if (profile == null || profile.isBlank()) {
            CURRENT_PROFILE.remove();
            return;
        }
        CURRENT_PROFILE.set(profile.trim());
    }

    static void clear() {
        CURRENT_PROFILE.remove();
    }
}
