package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.api.client.HttpExchangeCapture;
import java.util.List;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * BrickOwl transport. Each call is wrapped in the exchange capture, so a user who is recording sees exactly what was
 * sent and what came back; outside a recording it costs a thread-local check and nothing else.
 */
@Component
public class BrickOwlClient {

    public static final int MAX_BATCH_REQUESTS = 50;
    private static final String PROVIDER = "BrickOwl";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final BrickOwlSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;

    BrickOwlClient(BrickOwlSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    public List<BrickOwlOrderListItem> listOrders() {
        var apiKey = apiKey();
        return capture.record(PROVIDER, List.of(apiKey), () -> get(
                "/v1/order/list?key={key}",
                new ParameterizedTypeReference<List<BrickOwlOrderListItem>>() {},
                Map.of("key", apiKey)
        ));
    }

    public List<BrickOwlBatchResponse> executeBatch(List<BrickOwlBatchRequest> requests) {
        if (requests == null || requests.isEmpty()) {
            throw new IllegalArgumentException("Batch must contain at least one request");
        }
        if (requests.size() > MAX_BATCH_REQUESTS) {
            throw new IllegalArgumentException("Batch cannot contain more than 50 requests");
        }

        var apiKey = apiKey();
        var form = new LinkedMultiValueMap<String, String>();
        form.add("key", apiKey);
        form.add("requests", OBJECT_MAPPER.valueToTree(Map.of("requests", requests)).toString());

        return capture.record(PROVIDER, List.of(apiKey), () -> postBatch(form));
    }

    private List<BrickOwlBatchResponse> postBatch(LinkedMultiValueMap<String, String> form) {
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
