package com.vastbricks.agent;

import com.vastbricks.agent.v1.JobResult;
public class NoopAgentJobResultForwarder implements AgentJobResultForwarder {
    @Override
    public void forward(String agentId, JobResult result) {
        // Intentionally empty.
    }
}
