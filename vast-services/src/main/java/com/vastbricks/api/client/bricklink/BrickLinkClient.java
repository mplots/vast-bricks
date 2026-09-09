package com.vastbricks.api.client.bricklink;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.vastbricks.api.client.HttpExchangeCapture;
import java.net.URI;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * BrickLink's own store API, signed with the store's OAuth credentials.
 *
 * <p>The other half of BrickLink is {@code BrickStoreClient}, which reaches the pages a signed-in store sees. This
 * one is the published API, and it is the only side that states an order as BrickLink's own record of it — which is
 * what an archive is for.
 */
@Component
public class BrickLinkClient {

    private static final String PROVIDER = "BrickLink API";

    private final BrickLinkSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;
    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    BrickLinkClient(BrickLinkSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /** The store's orders, as BrickLink lists them. */
    public List<BrickLinkOrder> listOrders() {
        return capture.record(PROVIDER, secrets(), () -> {
            String json = get("orders");
            BrickLinkResponse<List<BrickLinkOrder>> response =
                    read(json, new TypeReference<BrickLinkResponse<List<BrickLinkOrder>>>() { }, "orders");
            return response.getData() == null ? List.of() : response.getData();
        });
    }

    /** One order, as BrickLink sent it and as it reads. */
    public BrickLinkOrderDocument getOrder(long orderId) {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }
        return capture.record(PROVIDER, secrets(), () -> {
            String path = "orders/" + orderId;
            String json = get(path);
            BrickLinkResponse<BrickLinkOrder> response =
                    read(json, new TypeReference<BrickLinkResponse<BrickLinkOrder>>() { }, path);
            if (response.getData() == null) {
                throw new BrickLinkClientException("BrickLink returned no data for order " + orderId);
            }
            return new BrickLinkOrderDocument(json, response.getData());
        });
    }

    private String get(String path) {
        URI uri = resolve(path);
        try {
            String body = restClient.get()
                    .uri(uri)
                    .accept(MediaType.APPLICATION_JSON)
                    .header(HttpHeaders.AUTHORIZATION, BrickLinkOAuth.authorization("GET", uri, settings))
                    .retrieve()
                    .body(String.class);
            return body == null ? "" : body;
        } catch (RestClientException exception) {
            throw new BrickLinkClientException("BrickLink request to " + path + " failed", exception);
        }
    }

    private <T> BrickLinkResponse<T> read(String json, TypeReference<BrickLinkResponse<T>> type, String path) {
        BrickLinkResponse<T> response;
        try {
            response = objectMapper.readValue(json, type);
        } catch (Exception exception) {
            throw new BrickLinkClientException("Could not read BrickLink's response to " + path, exception);
        }
        if (response == null) {
            throw new BrickLinkClientException("BrickLink returned an empty response for " + path);
        }
        requireAccepted(response.getMeta(), path);
        return response;
    }

    /**
     * BrickLink answers a refused request with HTTP 200 and the refusal in the envelope's meta, so the status alone
     * says nothing. A caller that read past it would take a request signed with the wrong credentials, or made from
     * an address the token is not allowed from, for a store that has no orders.
     */
    private void requireAccepted(BrickLinkResponse.Meta meta, String path) {
        if (meta == null) {
            throw new BrickLinkClientException("BrickLink's response to " + path + " states no meta");
        }
        Integer code = meta.getCode();
        if (code == null || code < 200 || code >= 300) {
            throw new BrickLinkClientException(
                    "BrickLink refused " + path + " with code " + code + ": " + meta.getMessage()
                            + (meta.getDescription() == null ? "" : " (" + meta.getDescription() + ")"));
        }
    }

    private URI resolve(String path) {
        String base = settings.getBaseUrl().trim();
        return URI.create(base.endsWith("/") ? base : base + "/").resolve(path);
    }

    /** What a recording of this client's traffic must not carry: the credentials that signed it. */
    private List<String> secrets() {
        requireConfigured();
        return List.of(
                settings.getConsumerKey().trim(),
                settings.getConsumerSecret().trim(),
                settings.getTokenValue().trim(),
                settings.getTokenSecret().trim());
    }

    private void requireConfigured() {
        if (settings.getConsumerKey().isBlank()
                || settings.getConsumerSecret().isBlank()
                || settings.getTokenValue().isBlank()
                || settings.getTokenSecret().isBlank()) {
            throw new BrickLinkClientException("BrickLink API credentials are not configured");
        }
    }
}
