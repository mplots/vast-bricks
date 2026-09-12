package com.vastbricks.api.setup.provideraccount;

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
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.TenantId;
import org.hibernate.type.SqlTypes;

/**
 * One tenant's own account with an external provider, e.g. one PayPal account: what is known in order to reach it.
 *
 * <p>Tenant-owned: {@code @TenantId} is the whole of making it so, same as {@code SettingsOverride}. {@code config}
 * is the provider's own config object, which Hibernate reads and writes as jsonb - the concrete class comes back
 * from the {@code provider} property Jackson writes into it. Secret fields are individually encrypted before this
 * entity ever sees them, so the column itself carries no plaintext credential.
 */
@Entity
@Table(name = "provider_accounts", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class ProviderAccount {

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
    private Provider provider;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private ProviderAccountConfig config;

    /** The periods of this account's data that count, empty for all of it. Provider-agnostic, so it sits here
     * rather than in a provider's own {@link ProviderAccountConfig}; jsonb like {@code config}, because it is only
     * ever read and replaced together with the account it belongs to. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "operating_periods", nullable = false)
    private List<OperatingPeriod> operatingPeriods = new ArrayList<>();

    @Column(nullable = false)
    private boolean enabled;

    /** Where this account sits in the tenant's own arrangement, counted from 0. Assigned on create, rewritten
     * whenever the tenant rearranges; not unique, so a rearrangement never has to dodge a constraint mid-update. */
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    ProviderAccount(String name, Provider provider, ProviderAccountConfig config) {
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
