package com.vastbricks.api.tenancy;

import java.util.List;
import java.util.Optional;

/**
 * Every tenant there is, for work that belongs to no login.
 *
 * <p>Separate from {@link TenantAccess} and {@link TenantProvisioning} for the same reason those two are separate
 * from each other: they are asked by different callers for different reasons. Access answers which tenants a person
 * may serve and provisioning creates them, while this answers which stores exist at all — which is what a scheduled
 * job has to know before it can run for each of them, there being no request and no login behind a cron.
 */
public interface TenantRoster {

    /** The active tenants, in a stable order, so a fan-out over them runs in the same order every time. */
    List<TenantView> active();

    /** The tenant a thread is bound to, named rather than merely numbered. */
    Optional<TenantView> byId(Long tenantId);
}
