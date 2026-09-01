package com.vastbricks.api.settings;

import java.util.Optional;
import java.util.function.Supplier;

public final class SettingsProfileContext {

    private static final ThreadLocal<String> CURRENT_PROFILE = new ThreadLocal<>();

    private SettingsProfileContext() {
    }

    public static Optional<String> currentProfile() {
        return Optional.ofNullable(CURRENT_PROFILE.get());
    }

    /**
     * Binds the calling thread's settings profile to {@code task} so it resolves the same overrides when it runs on
     * another thread. Must be called on the thread that owns the profile; the returned supplier can run anywhere.
     */
    public static <T> Supplier<T> propagate(Supplier<T> task) {
        var profile = CURRENT_PROFILE.get();
        return () -> {
            var previous = CURRENT_PROFILE.get();
            setProfile(profile);
            try {
                return task.get();
            } finally {
                setProfile(previous);
            }
        };
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
