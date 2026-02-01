package com.vastbricks.agent;

import com.vastbricks.agent.v1.JobAssignment;
import com.vastbricks.agent.v1.JobResult;
import com.vastbricks.agent.v1.JobType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

@Service
public class AgentJobService {
    private static final Logger logger = LoggerFactory.getLogger(AgentJobService.class);

    private final AgentSessionRegistry sessionRegistry;
    private final AgentJobResultForwarder resultForwarder;

    private final Queue<QueuedJob> queue = new ConcurrentLinkedQueue<>();
    private final Map<String, JobState> jobStates = new ConcurrentHashMap<>();
    private final Map<String, java.util.concurrent.CompletableFuture<JobResult>> jobResults = new ConcurrentHashMap<>();

    public AgentJobService(AgentSessionRegistry sessionRegistry, AgentJobResultForwarder resultForwarder) {
        this.sessionRegistry = sessionRegistry;
        this.resultForwarder = resultForwarder;
    }

    public AgentJobResponse submitJob(AgentJobRequest request) {
        String jobId = UUID.randomUUID().toString();
        JobAssignment assignment = JobAssignment.newBuilder()
                .setJobId(jobId)
                .setJobType(JobType.JOB_TYPE_CYPRESS_PDF)
                .setSpec(nullToEmpty(request.getSpec()))
                .setBaseUrl(nullToEmpty(request.getBaseUrl()))
                .setPdfPath(nullToEmpty(request.getPdfPath()))
                .setCommand(nullToEmpty(request.getCommand()))
                .putAllEnv(request.getEnv() == null ? Map.of() : request.getEnv())
                .build();

        QueuedJob queuedJob = new QueuedJob(assignment, request.getAgentId());
        queue.add(queuedJob);
        jobStates.put(jobId, new JobState(jobId, JobStatus.QUEUED, request.getAgentId()));

        dispatchJobs();

        JobState state = jobStates.get(jobId);
        return new AgentJobResponse(jobId, state != null ? state.status.name() : JobStatus.QUEUED.name());
    }

    public JobResult submitJobAndWait(AgentJobRequest request, long timeoutSeconds) {
        String jobId = UUID.randomUUID().toString();
        JobAssignment assignment = JobAssignment.newBuilder()
                .setJobId(jobId)
                .setJobType(JobType.JOB_TYPE_CYPRESS_PDF)
                .setSpec(nullToEmpty(request.getSpec()))
                .setBaseUrl(nullToEmpty(request.getBaseUrl()))
                .setPdfPath(nullToEmpty(request.getPdfPath()))
                .setCommand(nullToEmpty(request.getCommand()))
                .putAllEnv(request.getEnv() == null ? Map.of() : request.getEnv())
                .build();

        QueuedJob queuedJob = new QueuedJob(assignment, request.getAgentId());
        queue.add(queuedJob);
        jobStates.put(jobId, new JobState(jobId, JobStatus.QUEUED, request.getAgentId()));
        java.util.concurrent.CompletableFuture<JobResult> future = new java.util.concurrent.CompletableFuture<>();
        jobResults.put(jobId, future);

        dispatchJobs();

        try {
            return future.get(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception ex) {
            jobResults.remove(jobId);
            throw new RuntimeException("Timed out waiting for job result", ex);
        }
    }

    public void onAgentAvailable() {
        dispatchJobs();
    }

    public void onJobAck(String agentId, String jobId, boolean accepted, String message) {
        JobState state = jobStates.get(jobId);
        if (state == null) {
            return;
        }
        if (!accepted) {
            logger.warn("Agent {} rejected job {}: {}", agentId, jobId, message);
            state.status = JobStatus.REJECTED;
            sessionRegistry.get(agentId).ifPresent(AgentSession::markIdle);
            queue.add(new QueuedJob(state.assignment, state.requestedAgentId));
            state.status = JobStatus.QUEUED;
            dispatchJobs();
            return;
        }
        state.status = JobStatus.RUNNING;
    }

    public void onJobResult(String agentId, JobResult result) {
        JobState state = jobStates.get(result.getJobId());
        if (state != null) {
            state.status = result.getSuccess() ? JobStatus.SUCCEEDED : JobStatus.FAILED;
        }
        sessionRegistry.get(agentId).ifPresent(AgentSession::markIdle);
        resultForwarder.forward(agentId, result);
        java.util.concurrent.CompletableFuture<JobResult> future = jobResults.remove(result.getJobId());
        if (future != null) {
            future.complete(result);
        }
        dispatchJobs();
    }

    public void markAgentIdle(String agentId) {
        sessionRegistry.get(agentId).ifPresent(AgentSession::markIdle);
        dispatchJobs();
    }

    private synchronized void dispatchJobs() {
        while (true) {
            QueuedJob queuedJob = queue.peek();
            if (queuedJob == null) {
                return;
            }

            Optional<AgentSession> session = findSessionForJob(queuedJob);
            if (session.isEmpty()) {
                return;
            }

            AgentSession agentSession = session.get();
            if (!agentSession.markBusy()) {
                return;
            }

            queue.poll();
            agentSession.sendJob(queuedJob.assignment);
            JobState state = jobStates.get(queuedJob.assignment.getJobId());
            if (state != null) {
                state.status = JobStatus.ASSIGNED;
                state.assignment = queuedJob.assignment;
            }
        }
    }

    private Optional<AgentSession> findSessionForJob(QueuedJob queuedJob) {
        if (queuedJob.requestedAgentId != null && !queuedJob.requestedAgentId.isBlank()) {
            return sessionRegistry.get(queuedJob.requestedAgentId).filter(session -> !session.isBusy());
        }
        return sessionRegistry.getAvailable();
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static class QueuedJob {
        private final JobAssignment assignment;
        private final String requestedAgentId;

        private QueuedJob(JobAssignment assignment, String requestedAgentId) {
            this.assignment = assignment;
            this.requestedAgentId = requestedAgentId;
        }
    }

    private static class JobState {
        private final String jobId;
        private final String requestedAgentId;
        private JobStatus status;
        private JobAssignment assignment;

        private JobState(String jobId, JobStatus status, String requestedAgentId) {
            this.jobId = jobId;
            this.status = status;
            this.requestedAgentId = requestedAgentId;
        }
    }

    private enum JobStatus {
        QUEUED,
        ASSIGNED,
        RUNNING,
        SUCCEEDED,
        FAILED,
        REJECTED
    }
}
