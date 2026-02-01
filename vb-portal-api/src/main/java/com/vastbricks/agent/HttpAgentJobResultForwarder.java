package com.vastbricks.agent;

import com.vastbricks.agent.v1.JobResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

public class HttpAgentJobResultForwarder implements AgentJobResultForwarder {
    private static final Logger logger = LoggerFactory.getLogger(HttpAgentJobResultForwarder.class);

    private final RestTemplate restTemplate;
    private final String forwardUrl;

    public HttpAgentJobResultForwarder(String forwardUrl) {
        this.forwardUrl = forwardUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(60000);
        this.restTemplate = new RestTemplate(factory);
    }

    @Override
    public void forward(String agentId, JobResult result) {
        if (forwardUrl == null || forwardUrl.isBlank()) {
            return;
        }

        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("jobId", result.getJobId());
            body.add("agentId", agentId);
            body.add("success", Boolean.toString(result.getSuccess()));
            body.add("message", result.getMessage());
            body.add("contentType", result.getContentType());

            if (result.getPdf() != null && !result.getPdf().isEmpty()) {
                ByteArrayResource resource = new ByteArrayResource(result.getPdf().toByteArray()) {
                    @Override
                    public String getFilename() {
                        return result.getJobId() + ".pdf";
                    }
                };
                body.add("file", resource);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

            restTemplate.postForEntity(forwardUrl, request, String.class);
        } catch (Exception ex) {
            logger.warn("Failed to forward job result for agent {}: {}", agentId, ex.getMessage());
        }
    }
}
