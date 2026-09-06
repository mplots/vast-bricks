package com.vastbricks.api.tenancy;

import java.util.Optional;
import java.util.function.Supplier;

/**
 * Which tenant the request being served belongs to, and therefore whose provider credentials an outbound call made
 * while serving it reaches.
 *
 * <p>Modelled on {@code DebugContext}: a thread-local bound for the length of one request, with a propagate that
 * carries it onto another thread. Hibernate reads it through {@code VastTenantIdentifierResolver} to filter every
 * tenant-owned table, so a thread that lost the tenant is a thread that reads nobody's rows rather than everybody's.
 */
public final class TenantContext {

    /**
     * The tenant of a thread that has none. It is a value rather than {@code null} because Hibernate asks for a
     * tenant identifier whenever it opens a session, and a query filtered to a tenant that cannot exist returns
     * nothing — which is the safe answer for work that never said who it was for.
     */
    public static final Long NO_TENANT = -1L;

    private static final ThreadLocal<Long> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static Optional<Long> currentTenantId() {
        return Optional.ofNullable(CURRENT_TENANT.get());
    }

    /** The bound tenant, or {@link #NO_TENANT} on a thread that was never given one. */
    public static Long currentTenantIdOrNone() {
        Long tenantId = CURRENT_TENANT.get();
        return tenantId == null ? NO_TENANT : tenantId;
    }

    /**
     * Binds the calling thread's tenant to {@code task} so it resolves the same tenant-owned rows when it runs on
     * another thread. Must be called on the thread that owns the tenant; the returned supplier can run anywhere.
     */
    public static <T> Supplier<T> propagate(Supplier<T> task) {
        var tenantId = CURRENT_TENANT.get();
        return () -> {
            var previous = CURRENT_TENANT.get();
            setTenantId(tenantId);
            try {
                return task.get();
            } finally {
                setTenantId(previous);
            }
        };
    }

    public static void setTenantId(Long tenantId) {
        if (tenantId == null) {
            CURRENT_TENANT.remove();
            return;
        }
        CURRENT_TENANT.set(tenantId);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
