package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
@RequiredArgsConstructor
public class BrickOwlClient {

    public static final int MAX_BATCH_REQUESTS = 50;
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final BrickOwlSettings settings;
    private final RestClient restClient = RestClient.builder()
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();

    public List<BrickOwlOrderListItem> listOrders() {
        return get(
                "/v1/order/list?key={key}",
                new ParameterizedTypeReference<>() {},
                Map.of("key", apiKey())
        );
    }

    public List<BrickOwlBatchResponse> executeBatch(List<BrickOwlBatchRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("Batch must contain at least one request");
        }
        if (requests.size() > MAX_BATCH_REQUESTS) {
            throw new IllegalArgumentException("Batch cannot contain more than 50 requests");
        }

        var form = new LinkedMultiValueMap<String, String>();
        form.add("key", apiKey());
        form.add("requests", OBJECT_MAPPER.valueToTree(Map.of("requests", requests)).toString());

        try {
            return restClient.post()
                    .uri(url("/v1/bulk/batch"))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(new ParameterizedTypeReference<List<BrickOwlBatchResponse>>() {});
        } catch (RestClientException ex) {
            throw new BrickOwlClientException("BrickOwl batch request failed", ex);
        }
    }

    private <T> T get(String path, ParameterizedTypeReference<T> responseType, Map<String, ?> variables) {
        try {
            return restClient.get()
                    .uri(url(path), variables)
                    .retrieve()
                    .body(responseType);
        } catch (RestClientException ex) {
            throw new BrickOwlClientException("BrickOwl API request failed", ex);
        }
    }

    private String apiKey() {
        var apiKey = settings.getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new BrickOwlClientException("BrickOwl API key is not configured");
        }
        return apiKey.trim();
    }

    private String url(String path) {
        var baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new BrickOwlClientException("BrickOwl base URL is not configured");
        }
        return baseUrl.replaceAll("/+$", "") + path;
    }

}
