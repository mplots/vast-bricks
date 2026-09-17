package com.vastbricks.api.auth;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface ApiKeyRepository extends JpaRepository<ApiKey, Long> {

    Optional<ApiKey> findByTokenHash(String tokenHash);

    /** The caller's own keys for the tenant being served. The scoping is explicit because the table carries no
     * {@code @TenantId} - see {@link ApiKey}. */
    List<ApiKey> findByUserIdAndTenantIdOrderByIdAsc(Long userId, Long tenantId);

    Optional<ApiKey> findByIdAndUserIdAndTenantId(Long id, Long userId, Long tenantId);

    boolean existsByUserIdAndTenantIdAndNameIgnoreCase(Long userId, Long tenantId, String name);
}
