package com.vastbricks.api.job;

import com.vastbricks.api.debug.DebugContext;
import com.vastbricks.api.job.JobPayload.JobResponse;
import com.vastbricks.api.job.JobPayload.RunResponse;
import com.vastbricks.api.tenancy.TenantContext;
import com.vastbricks.api.tenancy.TenantRoster;
import com.vastbricks.api.tenancy.TenantView;
import jakarta.annotation.PreDestroy;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;

/**
 * Runs the registered jobs and keeps the account of what each run came to.
 *
 * <p>The registry is whatever {@link Job} beans the application holds, so a feature adds a job by declaring one.
 * Two questions are decided here and nowhere else: who a run is for — every active tenant when a cron fires it, the
 * serving tenant when a person does — and that one job runs once at a time per tenant.
 */
@Service
@RequiredArgsConstructor
@Slf4j
class JobService {

    private final List<Job> jobs;
    private final JobRuns runs;
    private final TenantRoster tenants;

    /**
     * The jobs running right now, keyed by job and tenant. This is the lock rather than the account: what a screen
     * reads is the stored run, which stays right across a restart in a way a set in memory could not.
     */
    private final Set<String> running = ConcurrentHashMap.newKeySet();

    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    /** Every registered job with its schedule, and what the serving tenant's last run of it came to. */
    List<JobResponse> statuses() {
        Long tenantId = TenantContext.currentTenantIdOrNone();
        return jobs.stream().map(job -> statusOf(job, tenantId)).toList();
    }

    JobResponse status(String code) {
        return statusOf(job(code), TenantContext.currentTenantIdOrNone());
    }

    /** That job's recent runs for the serving tenant, newest first. */
    List<RunResponse> history(String code, int limit) {
        job(code);
        return runs.recent(code, limit).stream().map(this::responseOf).toList();
    }

    /**
     * Starts a job for the tenant the caller serves, and returns the run it opened.
     *
     * <p>The row is opened here rather than on the worker thread, so the caller is answered with a run that already
     * exists and a screen reloading immediately sees the job working.
     */
    RunResponse trigger(String code) {
        Job job = job(code);
        Long tenantId = TenantContext.currentTenantIdOrNone();
        JobRun opened = reserveAndOpen(job, tenantId, JobTrigger.MANUAL);

        Supplier<Void> work = TenantContext.propagate(DebugContext.propagate(() -> {
            execute(job, tenantId, opened.getId());
            return null;
        }));
        executor.submit(work::get);

        return responseOf(opened);
    }

    /**
     * Runs a job for every active tenant, which is what a cron firing means.
     *
     * <p>Each store gets a run of its own, started on its own thread: a tenant's credentials are its own, so two
     * stores reach two different provider accounts and there is nothing shared between them to take turns over.
     * One store being slow, or failing, therefore says nothing about when the next one runs — and a job is only
     * single-flighted per tenant, so a store already running this job is skipped rather than delaying anyone.
     *
     * <p>The scheduler thread does not wait for them. Each run is its own account of itself, and there is nothing
     * to report back to: the whole point of storing runs is that nobody is watching when a cron fires.
     */
    void runForEveryTenant(Job job) {
        for (TenantView tenant : tenants.active()) {
            executor.submit(() -> runFor(job, tenant));
        }
    }

    /** One tenant's scheduled run, on a thread of its own, bound to that tenant for the whole of it. */
    private void runFor(Job job, TenantView tenant) {
        TenantContext.setTenantId(tenant.getId());
        try {
            JobRun opened = reserveAndOpen(job, tenant.getId(), JobTrigger.SCHEDULE);
            execute(job, tenant.getId(), opened.getId());
        } catch (JobAlreadyRunningException exception) {
            log.info("Scheduled job {} skipped for tenant {}: it is already running", job.code(), tenant.getCode());
        } catch (RuntimeException exception) {
            // The run could not even be opened, so nothing else will record this. One tenant's failure to start is
            // not the other tenants' problem, each having been started separately.
            log.error("Scheduled job {} could not be started for tenant {}", job.code(), tenant.getCode(), exception);
        } finally {
            TenantContext.clear();
        }
    }

    List<Job> registered() {
        return List.copyOf(jobs);
    }

    /**
     * Closes runs that a stopped process left open, tenant by tenant.
     *
     * <p>Per tenant because {@code @TenantId} puts the tenant in the SQL of every query over the table, which is
     * exactly what makes a sweep across all of them impossible to write by accident.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Order(1)
    void closeInterruptedRuns() {
        for (TenantView tenant : tenants.active()) {
            TenantContext.setTenantId(tenant.getId());
            try {
                int closed = runs.closeRunning();
                if (closed > 0) {
                    log.info("Closed {} job run(s) of tenant {} left running by a stopped process", closed, tenant.getCode());
                }
            } catch (RuntimeException exception) {
                log.error("Could not close the open job runs of tenant {}", tenant.getCode(), exception);
            } finally {
                TenantContext.clear();
            }
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    private JobRun reserveAndOpen(Job job, Long tenantId, JobTrigger trigger) {
        if (!running.add(key(job.code(), tenantId))) {
            throw new JobAlreadyRunningException(job.code());
        }
        try {
            return runs.open(job.code(), trigger);
        } catch (RuntimeException exception) {
            running.remove(key(job.code(), tenantId));
            throw exception;
        }
    }

    private void execute(Job job, Long tenantId, Long runId) {
        try {
            JobTally tally = job.run();
            runs.succeeded(runId, tally == null ? JobTally.empty() : tally);
        } catch (Exception exception) {
            // Logged where it failed, with its stack: the run row keeps the diagnostic a reader sees, and a cron
            // firing for every tenant would otherwise leave a failed store with no trace anywhere.
            log.error("Job {} failed for tenant {}", job.code(), tenantId, exception);
            runs.failed(runId, diagnostic(exception));
        } finally {
            running.remove(key(job.code(), tenantId));
        }
    }

    private JobResponse statusOf(Job job, Long tenantId) {
        RunResponse last = runs.latest(job.code()).map(this::responseOf).orElse(null);
        return new JobResponse(job.code(), job.cron().orElse(null), running.contains(key(job.code(), tenantId)), last);
    }

    private Job job(String code) {
        return jobs.stream()
                .filter(job -> job.code().equals(code))
                .findFirst()
                .orElseThrow(() -> new UnknownJobException(code));
    }

    private RunResponse responseOf(JobRun run) {
        return new RunResponse(
                run.getId(),
                run.getJobCode(),
                run.getTriggeredBy(),
                run.getOutcome(),
                run.getStartedAt(),
                run.getFinishedAt(),
                runs.tallyOf(run),
                run.getFailure());
    }

    private static String key(String code, Long tenantId) {
        return code + "/" + tenantId;
    }

    private static String diagnostic(Exception exception) {
        String message = exception.getMessage();
        String stated = message == null || message.isBlank() ? exception.getClass().getSimpleName() : message;
        return exception.getCause() == null ? stated : stated + ": " + exception.getCause().getMessage();
    }
}
