package com.vastbricks.agent;

import com.vastbricks.agent.v1.AgentEnvelope;
import com.vastbricks.agent.v1.AgentServiceGrpc;
import com.vastbricks.agent.v1.JobAck;
import com.vastbricks.agent.v1.JobProgress;
import com.vastbricks.agent.v1.JobResult;
import com.vastbricks.agent.v1.Register;
import io.grpc.stub.StreamObserver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AgentServiceImpl extends AgentServiceGrpc.AgentServiceImplBase {
    private static final Logger logger = LoggerFactory.getLogger(AgentServiceImpl.class);

    private final AgentSessionRegistry sessionRegistry;
    private final AgentJobService jobService;

    public AgentServiceImpl(AgentSessionRegistry sessionRegistry, AgentJobService jobService) {
        this.sessionRegistry = sessionRegistry;
        this.jobService = jobService;
    }

    @Override
    public StreamObserver<AgentEnvelope> connect(StreamObserver<AgentEnvelope> responseObserver) {
        return new StreamObserver<>() {
            private String agentId;

            @Override
            public void onNext(AgentEnvelope envelope) {
                if (envelope == null) {
                    return;
                }

                if (envelope.hasRegister()) {
                    handleRegister(envelope.getAgentId(), envelope.getRegister(), responseObserver);
                    return;
                }

                if (agentId == null || agentId.isBlank()) {
                    agentId = envelope.getAgentId();
                }

                if (envelope.hasHeartbeat()) {
                    sessionRegistry.get(agentId).ifPresent(AgentSession::updateHeartbeat);
                    return;
                }

                if (envelope.hasJobAck()) {
                    JobAck ack = envelope.getJobAck();
                    jobService.onJobAck(agentId, ack.getJobId(), ack.getAccepted(), ack.getMessage());
                    return;
                }

                if (envelope.hasJobProgress()) {
                    JobProgress progress = envelope.getJobProgress();
                    logger.info("Agent {} progress {}% for job {}: {}",
                            agentId, progress.getPercent(), progress.getJobId(), progress.getMessage());
                    return;
                }

                if (envelope.hasJobResult()) {
                    JobResult result = envelope.getJobResult();
                    jobService.onJobResult(agentId, result);
                }
            }

            @Override
            public void onError(Throwable t) {
                if (agentId != null) {
                    logger.warn("Agent {} disconnected: {}", agentId, t.getMessage());
                    sessionRegistry.remove(agentId);
                    jobService.markAgentIdle(agentId);
                }
            }

            @Override
            public void onCompleted() {
                if (agentId != null) {
                    logger.info("Agent {} stream completed", agentId);
                    sessionRegistry.remove(agentId);
                    jobService.markAgentIdle(agentId);
                }
                responseObserver.onCompleted();
            }

            private void handleRegister(String incomingAgentId, Register register, StreamObserver<AgentEnvelope> responseObserver) {
                if (incomingAgentId == null || incomingAgentId.isBlank()) {
                    responseObserver.onNext(AgentEnvelope.newBuilder()
                            .setError(com.vastbricks.agent.v1.Error.newBuilder().setMessage("Missing agent_id").build())
                            .build());
                    responseObserver.onCompleted();
                    return;
                }

                agentId = incomingAgentId;
                AgentSession session = new AgentSession(agentId, responseObserver);
                sessionRegistry.register(agentId, session);
                session.updateHeartbeat();
                logger.info("Registered agent {} ({})", agentId, register.getAgentName());
                jobService.onAgentAvailable();
            }
        };
    }
}
