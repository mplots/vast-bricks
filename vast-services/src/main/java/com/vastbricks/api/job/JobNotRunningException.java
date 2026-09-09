package com.vastbricks.api.job;

/**
 * There is no run of this job to stop for this tenant.
 *
 * <p>The same answer as a job that is already running, and for the same reason: what was asked for conflicts with
 * what the job is doing. Another tenant's run of the same job is not one this caller may stop.
 */
class JobNotRunningException extends RuntimeException {

    JobNotRunningException(String code) {
        super("Job " + code + " is not running for this tenant");
    }
}
