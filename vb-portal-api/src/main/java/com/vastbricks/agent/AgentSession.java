package com.vastbricks.agent;

import com.vastbricks.agent.v1.AgentEnvelope;
import com.vastbricks.agent.v1.JobAssignment;
import io.grpc.stub.StreamObserver;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicBoolean;

public class AgentSession {
    private final String agentId;
    private final StreamObserver<AgentEnvelope> responseObserver;
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile Instant lastHeartbeat = Instant.now();

    public AgentSession(String agentId, StreamObserver<AgentEnvelope> responseObserver) {
        this.agentId = agentId;
        this.responseObserver = responseObserver;
    }

    public String getAgentId() {
        return agentId;
    }

    public boolean isBusy() {
        return busy.get();
    }

    public boolean markBusy() {
        return busy.compareAndSet(false, true);
    }

    public void markIdle() {
        busy.set(false);
    }

    public Instant getLastHeartbeat() {
        return lastHeartbeat;
    }

    public void updateHeartbeat() {
        this.lastHeartbeat = Instant.now();
    }

    public void sendJob(JobAssignment assignment) {
        AgentEnvelope envelope = AgentEnvelope.newBuilder()
                .setAgentId(agentId)
                .setJobAssignment(assignment)
                .build();
        responseObserver.onNext(envelope);
    }

    public void sendError(String message) {
        AgentEnvelope envelope = AgentEnvelope.newBuilder()
                .setAgentId(agentId)
                .setError(com.vastbricks.agent.v1.Error.newBuilder().setMessage(message).build())
                .build();
        responseObserver.onNext(envelope);
    }
}
