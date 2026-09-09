package com.vastbricks.api.job;

/**
 * The job is already running for this tenant.
 *
 * <p>Refused rather than queued: a job reaches the same providers and writes the same files whichever run is doing
 * it, and two of them at once would race each other. Another tenant's run of the same job is not this.
 */
class JobAlreadyRunningException extends RuntimeException {

    JobAlreadyRunningException(String code) {
        super("Job " + code + " is already running for this tenant");
    }
}
