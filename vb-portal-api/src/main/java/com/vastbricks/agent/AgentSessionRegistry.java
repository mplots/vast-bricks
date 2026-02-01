package com.vastbricks.agent;

import java.time.Instant;
import java.util.Collection;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

@Component
public class AgentSessionRegistry {
    private final ConcurrentHashMap<String, AgentSession> sessions = new ConcurrentHashMap<>();

    public AgentSession register(String agentId, AgentSession session) {
        return sessions.put(agentId, session);
    }

    public void remove(String agentId) {
        sessions.remove(agentId);
    }

    public Optional<AgentSession> get(String agentId) {
        return Optional.ofNullable(sessions.get(agentId));
    }

    public Optional<AgentSession> getAvailable() {
        return sessions.values().stream().filter(session -> !session.isBusy()).findFirst();
    }

    public Collection<AgentSession> allSessions() {
        return sessions.values();
    }

    public void removeStale(long heartbeatTimeoutSeconds) {
        Instant cutoff = Instant.now().minusSeconds(heartbeatTimeoutSeconds);
        sessions.values().removeIf(session -> session.getLastHeartbeat().isBefore(cutoff));
    }
}
