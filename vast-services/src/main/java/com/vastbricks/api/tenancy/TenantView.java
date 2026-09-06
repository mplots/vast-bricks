package com.vastbricks.api.tenancy;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** A tenant as features outside this package see it. Keeps {@link Tenant} and its table from leaving the feature. */
@Getter
@AllArgsConstructor
public class TenantView {

    private final Long id;
    private final String code;
    private final String name;
}
