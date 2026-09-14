package com.vastbricks.api.job;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Every response body of the jobs feature. */
final class JobPayload {

    private JobPayload() {
    }

    @Getter
    @AllArgsConstructor
    static final class JobsResponse {

        private final List<JobResponse> jobs;
    }

    /**
     * A job as the screen reads it.
     *
     * <p>It carries the job's code rather than its name: the wording of a job belongs in the portal catalogs, as the
     * wording of its tally and of a reconciliation failure does.
     */
    @Getter
    @AllArgsConstructor
    static final class JobResponse {

        private final String code;

        /** The cron it fires on, or null for a job that only runs when someone asks for it. */
        private final String cron;

        /** The code of the job it follows, or null for a job nothing starts on its own. */
        private final String after;

        /** Whether it is working for the tenant asking. Another tenant's run of the same job is not this. */
        private final boolean running;

        /** How it last went for this tenant, or null if it has never run for them. */
        private final RunResponse lastRun;
    }

    @Getter
    @AllArgsConstructor
    static final class RunsResponse {

        private final List<RunResponse> runs;
    }

    @Getter
    @AllArgsConstructor
    static final class RunResponse {

        private final Long id;
        private final String jobCode;
        private final JobTrigger triggeredBy;
        private final JobOutcome outcome;
        private final Instant startedAt;
        private final Instant finishedAt;

        /** What the run came to, keyed by the job's own count names, which the portal words. */
        private final Map<String, Long> tally;

        /** Why it failed, as the exception stated it. A technical diagnostic, shown as it is. */
        private final String failure;
    }
}
