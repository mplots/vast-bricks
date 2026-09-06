package com.vastbricks.api.tenancy;

import com.vastbricks.api.tenancy.UserTenant.UserTenantId;
import java.util.List;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface UserTenantRepository extends JpaRepository<UserTenant, UserTenantId> {

    List<UserTenant> findByIdUserId(Long userId);

    boolean existsByIdUserIdAndIdTenantId(Long userId, Long tenantId);
}
