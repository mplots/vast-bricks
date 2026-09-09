package com.vastbricks.api.job;

import com.vastbricks.api.job.JobPayload.JobResponse;
import com.vastbricks.api.job.JobPayload.JobsResponse;
import com.vastbricks.api.job.JobPayload.RunResponse;
import com.vastbricks.api.job.JobPayload.RunsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * The jobs screen: what jobs there are, how each one last went, and firing one by hand.
 *
 * <p>Named {@code JobsController} rather than {@code JobController} because {@code vb-portal-api} already has a bean
 * of that name and the legacy launcher scans both.
 */
@RestController
@RequestMapping(path = "/api/private/jobs", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Slf4j
class JobsController {

    private static final int DEFAULT_HISTORY = 20;
    private static final int MAXIMUM_HISTORY = 100;

    private final JobService jobs;

    @GetMapping
    JobsResponse jobs() {
        return new JobsResponse(jobs.statuses());
    }

    @GetMapping("/{code}")
    JobResponse job(@PathVariable("code") String code) {
        return jobs.status(code);
    }

    /**
     * Starts the job for the tenant the caller serves.
     *
     * <p>Answered with the run it opened rather than with the run's result: a job queries providers and can take
     * minutes, so the screen watches the run it is handed instead of holding the request open.
     */
    @PostMapping("/{code}/run")
    ResponseEntity<RunResponse> run(@PathVariable("code") String code) {
        return ResponseEntity.accepted().body(jobs.trigger(code));
    }

    @GetMapping("/{code}/runs")
    RunsResponse runs(
            @PathVariable("code") String code,
            @RequestParam(value = "limit", required = false) Integer limit) {
        return new RunsResponse(jobs.history(code, historyLimit(limit)));
    }

    private static int historyLimit(Integer limit) {
        if (limit == null || limit < 1) {
            return DEFAULT_HISTORY;
        }
        return Math.min(limit, MAXIMUM_HISTORY);
    }

    @ExceptionHandler(UnknownJobException.class)
    ProblemDetail handleUnknownJob(UnknownJobException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, exception.getMessage());
        problem.setTitle("No such job");
        return problem;
    }

    @ExceptionHandler(JobAlreadyRunningException.class)
    ProblemDetail handleAlreadyRunning(JobAlreadyRunningException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, exception.getMessage());
        problem.setTitle("Job already running");
        return problem;
    }
}
