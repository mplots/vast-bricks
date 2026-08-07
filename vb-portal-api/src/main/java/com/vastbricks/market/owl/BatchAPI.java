package com.vastbricks.market.owl;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.util.LinkedMultiValueMap;

import java.util.List;
import java.util.Map;

public class BatchAPI {
    private static final int MAX_REQUESTS = 50;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final String baseUrl;
    private final String key;
    private final RestClient restClient;

    BatchAPI(String baseUrl, String key) {
        this(baseUrl, key, new RestClient());
    }

    BatchAPI(String baseUrl, String key, RestClient restClient) {
        this.baseUrl = baseUrl;
        this.key = key;
        this.restClient = restClient;
    }

    public List<BatchResponse> execute(List<BatchRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("Batch must contain at least one request");
        }
        if (requests.size() > MAX_REQUESTS) {
            throw new IllegalArgumentException("Batch cannot contain more than 50 requests");
        }

        var formData = new LinkedMultiValueMap<String, String>();
        formData.add("key", key);
        formData.add("requests", MAPPER.valueToTree(Map.of("requests", requests)).toString());

        return restClient.postForm(
                baseUrl + "/v1/bulk/batch",
                new ParameterizedTypeReference<List<BatchResponse>>() {},
                formData
        ).getBody();
    }
}
