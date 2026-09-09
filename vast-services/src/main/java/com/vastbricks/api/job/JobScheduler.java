package com.vastbricks.api.job;

import jakarta.annotation.PreDestroy;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.support.CronTrigger;
import org.springframework.stereotype.Component;

/**
 * Fires each job on the cron it declares, for every active tenant.
 *
 * <p>Off unless {@code VAST_JOBS_SCHEDULER_ENABLED} says otherwise, because a cron that fires by default fires in
 * every runtime this module is composed into — an acceptance run against mocked providers, and a developer's local
 * launch against real credentials. The deployment turns it on deliberately; nothing else does.
 *
 * <p>It runs its jobs on a scheduler of its own rather than through {@code @EnableScheduling}, so that composing
 * {@code vast-services} into {@code vb-portal-api} changes nothing about how the legacy application's own scheduled
 * work is executed. A job's cron is its own declaration, so adding one schedules it without touching this class.
 */
@Component
@ConditionalOnProperty(name = "VAST_JOBS_SCHEDULER_ENABLED", havingValue = "true")
@RequiredArgsConstructor
@Slf4j
class JobScheduler {

    private final JobService jobs;

    private ThreadPoolTaskScheduler scheduler;

    @EventListener(ApplicationReadyEvent.class)
    @Order(2)
    void schedule() {
        List<Job> scheduled = jobs.registered().stream().filter(job -> job.cron().isPresent()).toList();
        if (scheduled.isEmpty()) {
            log.info("Job scheduler enabled, but no job declares a cron");
            return;
        }

        // One thread per scheduled job: they are hours apart in practice, but a job that runs for every tenant can
        // run long, and a long one must not hold up the next job's hour.
        scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(scheduled.size());
        scheduler.setThreadNamePrefix("vast-job-");
        scheduler.setWaitForTasksToCompleteOnShutdown(false);
        scheduler.initialize();

        scheduled.forEach(job -> {
            scheduler.schedule(() -> jobs.runForEveryTenant(job), new CronTrigger(job.cron().orElseThrow()));
            log.info("Scheduled job {} on cron {}", job.code(), job.cron().orElseThrow());
        });
    }

    @PreDestroy
    void stop() {
        if (scheduler != null) {
            scheduler.shutdown();
        }
    }
}
