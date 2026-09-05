package com.vastbricks.api.reconciliation;

import com.vastbricks.api.debug.DebugContext;
import com.vastbricks.api.settings.SettingsProfileContext;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;

/**
 * Runs reconciliation provider calls concurrently on virtual threads. A task starts as soon as it is submitted, so a
 * caller can start every independent call before joining the first result. The returned supplier joins that task and
 * rethrows its runtime failure unwrapped.
 */
public final class ParallelTasks implements AutoCloseable {

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    public <T> Supplier<T> start(Supplier<T> task) {
        // Both request contexts cross the thread boundary: the settings profile so the task resolves the same
        // overrides, and the debug user so a provider call it makes is recorded under whoever asked for it.
        var carried = SettingsProfileContext.propagate(DebugContext.propagate(task));
        var future = CompletableFuture.supplyAsync(carried, executor);
        return () -> await(future);
    }

    @Override
    public void close() {
        executor.close();
    }

    private static <T> T await(CompletableFuture<T> future) {
        try {
            return future.join();
        } catch (CompletionException exception) {
            if (exception.getCause() instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw exception;
        }
    }
}
