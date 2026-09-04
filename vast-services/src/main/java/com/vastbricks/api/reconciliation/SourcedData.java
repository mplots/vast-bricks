package com.vastbricks.api.reconciliation;

import java.util.List;
import java.util.Map;

/**
 * What the sourcing stage fetched, keyed by the class each source returns. This is where the sourcing and mapping
 * stages meet: a mapper asks for the class it reads and gets that source's data, without either side naming the
 * other.
 */
final class SourcedData {

    private final Map<Class<?>, List<?>> byType;

    SourcedData(Map<Class<?>, List<?>> byType) {
        this.byType = Map.copyOf(byType);
    }

    /**
     * What was sourced for this class, or nothing when no source returns it. An unsourced class is not an error: a
     * source and the mapper that reads it can be added in separate steps, and until both exist nothing is mapped.
     *
     * <p>The cast is sound because the map is keyed by the very class its list holds.
     */
    @SuppressWarnings("unchecked")
    <T> List<T> of(Class<T> type) {
        return (List<T>) byType.getOrDefault(type, List.of());
    }
}
