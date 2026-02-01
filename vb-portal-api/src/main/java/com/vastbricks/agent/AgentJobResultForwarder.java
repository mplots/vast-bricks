package com.vastbricks.agent;

import com.vastbricks.agent.v1.JobResult;

public interface AgentJobResultForwarder {
    void forward(String agentId, JobResult result);
}
