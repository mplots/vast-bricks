package com.vastbricks.api.tenancy;

/**
 * Creates tenants and grants memberships.
 *
 * <p>Separate from {@link TenantAccess} because the two are asked by different callers for different reasons:
 * access is read on every request, provisioning only when a store is onboarded.
 */
public interface TenantProvisioning {

    /** Creates a tenant, or returns the existing one when the code is already taken. */
    TenantView create(String code, String name);

    /** Lets this user serve this tenant. Granting a membership twice is not an error. */
    void addMember(Long userId, Long tenantId);
}
