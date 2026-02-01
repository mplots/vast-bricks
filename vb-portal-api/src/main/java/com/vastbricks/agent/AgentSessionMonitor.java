package com.vastbricks.agent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class AgentSessionMonitor {
    private static final Logger logger = LoggerFactory.getLogger(AgentSessionMonitor.class);

    private final AgentSessionRegistry sessionRegistry;
    private final AgentProperties agentProperties;

    public AgentSessionMonitor(AgentSessionRegistry sessionRegistry, AgentProperties agentProperties) {
        this.sessionRegistry = sessionRegistry;
        this.agentProperties = agentProperties;
    }

    @Scheduled(fixedDelayString = "${agent.heartbeat-timeout-seconds:90}000")
    public void cleanupStaleSessions() {
        int before = sessionRegistry.allSessions().size();
        sessionRegistry.removeStale(agentProperties.getHeartbeatTimeoutSeconds());
        int after = sessionRegistry.allSessions().size();
        if (after < before) {
            logger.warn("Removed {} stale agent session(s)", before - after);
        }
    }
}
