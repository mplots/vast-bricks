package com.vastbricks.api.job;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.TenantId;

/**
 * One run of one job for one tenant.
 *
 * <p>Tenant-owned: {@code @TenantId} is the whole of making it so. A tenant sees the runs of its own store and no
 * other's, including the ones a cron started on its behalf while nobody was logged in.
 */
@Entity
@Table(name = "job_runs", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class JobRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @TenantId
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "job_code", nullable = false, length = 100)
    private String jobCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "triggered_by", nullable = false, length = 10)
    private JobTrigger triggeredBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private JobOutcome outcome;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    /** What the run came to, as the JSON object of counts the job's tally makes. */
    @Column
    private String tally;

    /** Why it failed, as the exception stated it. A diagnostic rather than wording for a reader. */
    @Column
    private String failure;
}
