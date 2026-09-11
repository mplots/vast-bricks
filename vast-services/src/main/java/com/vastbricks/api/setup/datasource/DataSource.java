package com.vastbricks.api.setup.datasource;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

/**
 * One tenant's own configured data source, e.g. one PayPal account.
 *
 * <p>Tenant-owned: {@code @TenantId} is the whole of making it so, same as {@code SettingsOverride}. {@code config}
 * is the provider's own config object, which Hibernate reads and writes as jsonb - the concrete class comes back
 * from the {@code provider} property Jackson writes into it. Secret fields are individually encrypted before this
 * entity ever sees them, so the column itself carries no plaintext credential.
 */
@Entity
@Table(name = "data_sources", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class DataSource {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private DataSourceProvider provider;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private DataSourceConfig config;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    DataSource(String name, DataSourceProvider provider, DataSourceConfig config) {
        this.name = name;
        this.provider = provider;
        this.config = config;
        this.enabled = true;
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void markUpdated() {
        updatedAt = Instant.now();
    }
}
