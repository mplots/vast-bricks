package com.vastbricks.agent;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AgentJobResultForwarderConfig {
    @Bean
    public AgentJobResultForwarder agentJobResultForwarder(AgentProperties agentProperties) {
        String forwardUrl = agentProperties.getResults().getForwardUrl();
        if (forwardUrl != null && !forwardUrl.isBlank()) {
            return new HttpAgentJobResultForwarder(forwardUrl);
        }
        return new NoopAgentJobResultForwarder();
    }
}
