package com.vastbricks.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A long-lived credential a user generates for an external program to call the API with, in place of a login.
 *
 * <p>Identity rather than tenant-owned data, for the same reason {@code UserTenant} is: the key is what a request is
 * read against to decide its tenant, so it carries no {@code @TenantId} - a filter by the serving tenant would need
 * the answer this row exists to give. Management queries name the user and tenant themselves instead.
 *
 * <p>The secret is never stored. Only its SHA-256 and its opening characters are, so the row can recognise a
 * presented key and a list of keys can still be told apart.
 */
@Entity
@Table(name = "api_keys", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class ApiKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Who generated it. A key authenticates as its issuing user and reaches exactly what that user could. */
    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    /** The one store this key serves, stated at generation because the program presenting it has no login. */
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "token_hash", nullable = false, length = 64, updatable = false)
    private String tokenHash;

    @Column(name = "token_prefix", nullable = false, length = 20, updatable = false)
    private String tokenPrefix;

    /** Written by Java rather than left to the column default, so the one response carrying the secret can state
     * when the key was generated without reading the row back. */
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    /** Null never expires, which is what an unattended program normally needs. */
    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    ApiKey(Long userId, Long tenantId, String name, String tokenHash, String tokenPrefix, Instant expiresAt) {
        this.userId = userId;
        this.tenantId = tenantId;
        this.name = name;
        this.tokenHash = tokenHash;
        this.tokenPrefix = tokenPrefix;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
    }

    boolean isExpired(Instant now) {
        return expiresAt != null && !expiresAt.isAfter(now);
    }
}
