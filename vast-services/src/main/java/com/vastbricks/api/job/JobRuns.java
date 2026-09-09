package com.vastbricks.api.job;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Where a run is written down.
 *
 * <p>Its own component rather than methods on {@link JobService} because a job runs on a background thread and each
 * write is its own transaction: opening a row has to be committed before the work starts, or a screen asking what is
 * running would see nothing until the job finished. Self-invocation would bypass the proxy that makes that so.
 */
@Component
@RequiredArgsConstructor
@Slf4j
class JobRuns {

    private final JobRunRepository repository;
    private final ObjectMapper objectMapper;

    /** Opens a run for the bound tenant, committed before the job starts so the screen can see it working. */
    @Transactional
    JobRun open(String jobCode, JobTrigger trigger) {
        JobRun run = new JobRun();
        run.setJobCode(jobCode);
        run.setTriggeredBy(trigger);
        run.setOutcome(JobOutcome.RUNNING);
        run.setStartedAt(Instant.now());
        return repository.save(run);
    }

    @Transactional
    void succeeded(Long runId, JobTally tally) {
        close(runId, JobOutcome.SUCCEEDED, run -> run.setTally(writeTally(tally)));
    }

    @Transactional
    void failed(Long runId, String diagnostic) {
        close(runId, JobOutcome.FAILED, run -> run.setFailure(diagnostic));
    }

    /**
     * Closes every run of the bound tenant that is still open, as interrupted.
     *
     * <p>Called for each tenant as the application starts. Nothing in progress survives a restart, so a row still
     * claiming to be running was left behind by a process that is gone.
     */
    @Transactional
    int closeRunning() {
        List<JobRun> stale = repository.findByOutcome(JobOutcome.RUNNING);
        stale.forEach(run -> {
            run.setOutcome(JobOutcome.INTERRUPTED);
            run.setFinishedAt(Instant.now());
        });
        return stale.size();
    }

    @Transactional(readOnly = true)
    Optional<JobRun> latest(String jobCode) {
        return repository.findFirstByJobCodeOrderByStartedAtDescIdDesc(jobCode);
    }

    @Transactional(readOnly = true)
    List<JobRun> recent(String jobCode, int limit) {
        return repository.findByJobCodeOrderByStartedAtDescIdDesc(jobCode, Limit.of(limit));
    }

    /** The counts a stored run came to, in the order the job stated them. */
    Map<String, Long> tallyOf(JobRun run) {
        if (run.getTally() == null || run.getTally().isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(run.getTally(), new TypeReference<LinkedHashMap<String, Long>>() { });
        } catch (Exception exception) {
            log.warn("Could not read the tally of job run {}", run.getId(), exception);
            return Map.of();
        }
    }

    private void close(Long runId, JobOutcome outcome, Consumer<JobRun> detail) {
        repository.findById(runId).ifPresent(run -> {
            run.setOutcome(outcome);
            run.setFinishedAt(Instant.now());
            detail.accept(run);
        });
    }

    private String writeTally(JobTally tally) {
        if (tally == null || tally.counts().isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(tally.counts());
        } catch (Exception exception) {
            // A tally that cannot be written down is not a failed run: the job did its work.
            log.warn("Could not write the tally of a job run", exception);
            return null;
        }
    }
}
