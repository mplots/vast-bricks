package com.vastbricks.api.job;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/** How a run ended, or that it has not. */
@Getter
@RequiredArgsConstructor
enum JobOutcome {

    /** Still going. The only outcome a row is written with, and the one the screen reads as a running job. */
    RUNNING("running"),

    SUCCEEDED("succeeded"),

    /** The job threw. What it threw is kept beside the outcome as a technical diagnostic. */
    FAILED("failed"),

    /**
     * Someone asked for it to stop while it was going. Not a failure: the job did not break, it was stopped, so a
     * cancelled run keeps whatever it managed to count and states no diagnostic.
     */
    CANCELLED("cancelled"),

    /**
     * The process stopped while the run was going. Nothing in progress survives a restart, so a row left running is
     * closed this way rather than left to claim forever that the job is still working.
     */
    INTERRUPTED("interrupted");

    @JsonValue
    private final String code;
}
