package com.vastbricks.api.tenancy;

import java.util.List;
import java.util.Optional;

/**
 * Which tenants a login may serve, and which one a request without a login acts as.
 *
 * <p>The public API of the tenancy feature: everything else it holds — the tables, the membership entity, the
 * Hibernate resolver — is an implementation detail of enforcing what this interface answers. Membership is asked on
 * every request rather than trusted from the token, so a membership taken away stops working at once instead of when
 * the token expires.
 */
public interface TenantAccess {

    /** The active tenants this user may serve, in a stable order so a login without a choice is repeatable. */
    List<TenantView> tenantsOf(Long userId);

    /** The tenant this user asked for, or empty when they named one they may not serve. */
    Optional<TenantView> selectFor(Long userId, String tenantCode);

    /** Whether this user may still serve this tenant. */
    boolean canServe(Long userId, Long tenantId);

    /**
     * The tenant with this code, for the one caller that knows which store it serves without a login behind it.
     *
     * <p>Deliberately not a fallback. A request that cannot say which tenant it is for gets none, reads nothing and
     * writes nowhere; only a caller naming a tenant outright reaches one.
     */
    Optional<Long> tenantIdByCode(String code);
}
