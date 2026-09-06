package com.vastbricks.api.tenancy;

import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Tells Hibernate which tenant is asking, so it appends the tenant to the SQL it generates for every entity carrying
 * a {@code @TenantId} field and stamps that tenant on insert.
 *
 * <p>This is what replaces a {@code WHERE tenant_id = ?} nobody can forget: feature code never names the tenant, and
 * an entity that joins the tenant-owned set is filtered from the moment its field is annotated.
 */
@Component
class VastTenantIdentifierResolver implements CurrentTenantIdentifierResolver<Long>, HibernatePropertiesCustomizer {

    @Override
    public Long resolveCurrentTenantIdentifier() {
        return TenantContext.currentTenantIdOrNone();
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        // A session outlives the request only in background work, which binds its own tenant before querying.
        return false;
    }

    @Override
    public void customize(Map<String, Object> hibernateProperties) {
        hibernateProperties.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, this);
    }
}
