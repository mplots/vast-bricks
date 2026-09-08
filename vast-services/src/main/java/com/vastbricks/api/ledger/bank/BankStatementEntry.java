package com.vastbricks.api.ledger.bank;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/**
 * One booked entry of a tenant's bank account.
 *
 * <p>Tenant-owned: {@code @TenantId} is the whole of making it so. Hibernate stamps the serving tenant on insert and
 * appends it to the SQL of every query it generates for this entity, including a load by primary key, so no
 * repository method names the tenant and none can forget to.
 */
@Entity
@Table(name = "bank_statement_entries", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class BankStatementEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "account_iban", nullable = false, length = 34)
    private String accountIban;

    /** The bank's own reference, which is what a re-import finds an entry it already holds by. */
    @Column(name = "entry_reference", nullable = false, length = 140)
    private String entryReference;

    @Column(name = "booking_date", nullable = false)
    private LocalDate bookingDate;

    @Column(name = "value_date")
    private LocalDate valueDate;

    /** Unsigned, the way camt states it; {@link #direction} says which way it went. */
    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private BankStatementDirection direction;

    @Column(nullable = false, length = 10)
    private String status;

    @Column(name = "domain_code", length = 10)
    private String domainCode;

    @Column(name = "family_code", length = 10)
    private String familyCode;

    @Column(name = "sub_family_code", length = 10)
    private String subFamilyCode;

    @Column(name = "proprietary_code", length = 35)
    private String proprietaryCode;

    @Column(name = "counterparty_name")
    private String counterpartyName;

    @Column(name = "counterparty_iban", length = 34)
    private String counterpartyIban;

    @Column(name = "counterparty_bic", length = 11)
    private String counterpartyBic;

    @Column(name = "end_to_end_id", length = 35)
    private String endToEndId;

    @Column(name = "instruction_id", length = 35)
    private String instructionId;

    @Column(name = "remittance_information")
    private String remittanceInformation;

    /**
     * What a person wrote to tie this entry to an order when every automatic match failed. The only column here an
     * import must leave alone, which is why nothing in {@link BankStatementService#importDocument} writes it.
     */
    @Column
    private String mapping;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    BankStatementEntry(String accountIban, String entryReference) {
        this.accountIban = accountIban;
        this.entryReference = entryReference;
        this.updatedAt = Instant.now();
    }

    @PreUpdate
    void markUpdated() {
        updatedAt = Instant.now();
    }
}
