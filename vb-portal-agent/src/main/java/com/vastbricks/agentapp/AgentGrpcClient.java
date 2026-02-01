package com.vastbricks.agentapp;

import com.vastbricks.agent.v1.AgentEnvelope;
import com.vastbricks.agent.v1.AgentServiceGrpc;
import com.vastbricks.agent.v1.Heartbeat;
import com.vastbricks.agent.v1.JobAck;
import com.vastbricks.agent.v1.JobAssignment;
import com.vastbricks.agent.v1.JobProgress;
import com.vastbricks.agent.v1.JobResult;
import com.vastbricks.agent.v1.Register;
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.Metadata;
import io.grpc.stub.MetadataUtils;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
public class AgentGrpcClient {
    private static final Logger logger = LoggerFactory.getLogger(AgentGrpcClient.class);

    private final AgentClientProperties properties;
    private final AgentJobExecutor jobExecutor;

    private final ExecutorService jobExecutorService = Executors.newSingleThreadExecutor();
    private final ExecutorService connectionExecutor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicBoolean reconnecting = new AtomicBoolean(false);

    private volatile ManagedChannel channel;
    private volatile StreamObserver<AgentEnvelope> requestObserver;
    private String agentId;

    public AgentGrpcClient(AgentClientProperties properties, AgentJobExecutor jobExecutor) {
        this.properties = properties;
        this.jobExecutor = jobExecutor;
    }

    @PostConstruct
    public void start() {
        agentId = properties.getId();
        if (agentId == null || agentId.isBlank()) {
            agentId = UUID.randomUUID().toString();
        }
        connectInternal();
    }

    @PreDestroy
    public void stop() {
        if (channel != null) {
            channel.shutdown();
        }
        jobExecutorService.shutdown();
        connectionExecutor.shutdown();
    }

    @Scheduled(fixedDelayString = "${agent.heartbeat-interval-seconds:30}000")
    public void sendHeartbeat() {
        StreamObserver<AgentEnvelope> observer = requestObserver;
        if (observer == null) {
            return;
        }

        AgentEnvelope envelope = AgentEnvelope.newBuilder()
                .setAgentId(agentId)
                .setHeartbeat(Heartbeat.newBuilder().setTimestampEpochMs(Instant.now().toEpochMilli()).build())
                .build();
        try {
            observer.onNext(envelope);
        } catch (Exception ex) {
            logger.warn("Heartbeat failed: {}", ex.getMessage());
        }
    }

    private synchronized void connectInternal() {
        if (channel != null) {
            channel.shutdownNow();
        }

        channel = ManagedChannelBuilder.forAddress(properties.getServer().getHost(), properties.getServer().getPort())
                .usePlaintext()
                .keepAliveTime(120, TimeUnit.SECONDS)
                .keepAliveTimeout(20, TimeUnit.SECONDS)
                .build();

        AgentServiceGrpc.AgentServiceStub stub = AgentServiceGrpc.newStub(channel)
                .withInterceptors(MetadataUtils.newAttachHeadersInterceptor(apiKeyHeaders()));

        requestObserver = stub.connect(new StreamObserver<>() {
            @Override
            public void onNext(AgentEnvelope envelope) {
                if (envelope.hasJobAssignment()) {
                    handleJobAssignment(envelope.getJobAssignment());
                } else if (envelope.hasError()) {
                    logger.warn("Server error: {}", envelope.getError().getMessage());
                }
            }

            @Override
            public void onError(Throwable t) {
                logger.warn("Agent stream error: {}", t.getMessage());
                scheduleReconnect();
            }

            @Override
            public void onCompleted() {
                logger.info("Agent stream completed");
                scheduleReconnect();
            }
        });

        sendRegister();
    }

    private void scheduleReconnect() {
        if (reconnecting.getAndSet(true)) {
            return;
        }

        connectionExecutor.submit(() -> {
            try {
                Thread.sleep(3000);
                connectInternal();
            } catch (InterruptedException ex) {
                Thread.currentThread().interrupt();
            } finally {
                reconnecting.set(false);
            }
        });
    }

    private Metadata apiKeyHeaders() {
        Metadata metadata = new Metadata();
        String apiKey = properties.getApiKey();
        if (apiKey != null && !apiKey.isBlank()) {
            Metadata.Key<String> apiKeyHeader = Metadata.Key.of("x-api-key", Metadata.ASCII_STRING_MARSHALLER);
            metadata.put(apiKeyHeader, apiKey);
        }
        return metadata;
    }

    private void sendRegister() {
        StreamObserver<AgentEnvelope> observer = requestObserver;
        if (observer == null) {
            return;
        }

        Register register = Register.newBuilder()
                .setAgentName(properties.getName())
                .setVersion(properties.getVersion())
                .addAllCapabilities(properties.getCapabilities())
                .build();

        AgentEnvelope envelope = AgentEnvelope.newBuilder()
                .setAgentId(agentId)
                .setRegister(register)
                .build();

        observer.onNext(envelope);
    }

    private void handleJobAssignment(JobAssignment assignment) {
        if (!busy.compareAndSet(false, true)) {
            sendAck(assignment.getJobId(), false, "Agent busy");
            return;
        }

        sendAck(assignment.getJobId(), true, "Accepted");

        jobExecutorService.submit(() -> {
            sendProgress(assignment.getJobId(), 5, "Starting execution");
            JobExecutionResult result = jobExecutor.execute(assignment);
            sendProgress(assignment.getJobId(), 100, "Execution finished");
            sendResult(assignment, result);
            busy.set(false);
        });
    }

    private void sendAck(String jobId, boolean accepted, String message) {
        JobAck ack = JobAck.newBuilder()
                .setJobId(jobId)
                .setAccepted(accepted)
                .setMessage(message == null ? "" : message)
                .build();

        sendEnvelope(AgentEnvelope.newBuilder().setAgentId(agentId).setJobAck(ack).build());
    }

    private void sendProgress(String jobId, int percent, String message) {
        JobProgress progress = JobProgress.newBuilder()
                .setJobId(jobId)
                .setPercent(percent)
                .setMessage(message == null ? "" : message)
                .build();

        sendEnvelope(AgentEnvelope.newBuilder().setAgentId(agentId).setJobProgress(progress).build());
    }

    private void sendResult(JobAssignment assignment, JobExecutionResult result) {
        JobResult.Builder builder = JobResult.newBuilder()
                .setJobId(assignment.getJobId())
                .setSuccess(result.isSuccess())
                .setMessage(result.getMessage() == null ? "" : result.getMessage())
                .setContentType("application/pdf");

        if (result.getPdfBytes() != null) {
            builder.setPdf(com.google.protobuf.ByteString.copyFrom(result.getPdfBytes()));
        }
        if (result.getMeta() != null && !result.getMeta().isEmpty()) {
            builder.putAllMeta(result.getMeta());
        }

        sendEnvelope(AgentEnvelope.newBuilder().setAgentId(agentId).setJobResult(builder.build()).build());
    }

    private void sendEnvelope(AgentEnvelope envelope) {
        StreamObserver<AgentEnvelope> observer = requestObserver;
        if (observer == null) {
            return;
        }
        try {
            observer.onNext(envelope);
        } catch (Exception ex) {
            logger.warn("Failed to send message: {}", ex.getMessage());
        }
    }
}
