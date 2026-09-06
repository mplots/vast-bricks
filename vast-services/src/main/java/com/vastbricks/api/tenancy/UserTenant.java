package com.vastbricks.api.tenancy;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Objects;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Which tenants a login may serve.
 *
 * <p>Identity rather than tenant-owned data, for the same reason {@link Tenant} is: the membership is what a login
 * is read against to decide its tenant, so filtering it by the tenant would need the answer it exists to give.
 */
@Entity
@Table(name = "user_tenants", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class UserTenant {

    @EmbeddedId
    private UserTenantId id;

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    static class UserTenantId implements Serializable {

        @Column(name = "user_id", nullable = false)
        private Long userId;

        @Column(name = "tenant_id", nullable = false)
        private Long tenantId;

        @Override
        public boolean equals(Object other) {
            if (this == other) {
                return true;
            }
            if (!(other instanceof UserTenantId that)) {
                return false;
            }
            return Objects.equals(userId, that.userId) && Objects.equals(tenantId, that.tenantId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, tenantId);
        }
    }
}
