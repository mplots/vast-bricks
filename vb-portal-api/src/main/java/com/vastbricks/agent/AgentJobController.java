package com.vastbricks.agent;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/agents/jobs")
public class AgentJobController {
    private final AgentJobService agentJobService;

    public AgentJobController(AgentJobService agentJobService) {
        this.agentJobService = agentJobService;
    }

    @PostMapping
    public ResponseEntity<AgentJobResponse> submitJob(@RequestBody AgentJobRequest request) {
        return ResponseEntity.ok(agentJobService.submitJob(request));
    }
}
