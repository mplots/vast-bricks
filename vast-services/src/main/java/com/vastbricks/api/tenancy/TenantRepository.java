package com.vastbricks.api.tenancy;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findByCode(String code);

    List<Tenant> findByActiveTrueOrderByIdAsc();
}
