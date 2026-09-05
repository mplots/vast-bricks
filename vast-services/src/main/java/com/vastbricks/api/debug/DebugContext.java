package com.vastbricks.api.debug;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Who the request being served belongs to, so an outbound call made while serving it can be recorded under that user.
 *
 * <p>Modelled on {@code SettingsProfileContext}: a thread-local bound for the length of one request, with a propagate
 * that carries it onto another thread. Recording is per user, so a call made on a thread that lost the user is a call
 * nobody can see.
 */
public final class DebugContext {

    private static final ThreadLocal<Long> CURRENT_USER = new ThreadLocal<>();

    private DebugContext() {
    }

    public static Optional<Long> currentUserId() {
        return Optional.ofNullable(CURRENT_USER.get());
    }

    /**
     * Binds the calling thread's user to {@code task} so it records under the same user when it runs on another
     * thread. Must be called on the thread that owns the user; the returned supplier can run anywhere.
     */
    public static <T> Supplier<T> propagate(Supplier<T> task) {
        var userId = CURRENT_USER.get();
        return () -> {
            var previous = CURRENT_USER.get();
            setUserId(userId);
            try {
                return task.get();
            } finally {
                setUserId(previous);
            }
        };
    }

    static void setUserId(Long userId) {
        if (userId == null) {
            CURRENT_USER.remove();
            return;
        }
        CURRENT_USER.set(userId);
    }

    static void clear() {
        CURRENT_USER.remove();
    }
}
