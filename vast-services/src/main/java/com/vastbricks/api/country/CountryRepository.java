package com.vastbricks.api.country;

import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The country reference table.
 *
 * <p>Unlike a tenant-owned repository here, these queries carry no tenant and Hibernate adds none: the entity has no
 * {@code @TenantId} because a country belongs to no store.
 */
@DependsOn("vastDatabaseMigration")
interface CountryRepository extends JpaRepository<Country, String> {
}
