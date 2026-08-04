package com.vastbricks.client.brickstore;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class BrickStoreClient {
    static final String CLIENT_ID = "ca629c09-4d8c-45dc-8a6f-bfb2b058f720";

    private static final URI SESSION_URI = URI.create(
            "https://account.prod.member.bricklink.info/api/v1/actions/verify-and-create-session"
    );
    private static final URI ORDER_EXPORT_URI = URI.create("https://www.bricklink.com/orderExcelFinal.asp");
    private static final String CLIENT_ID_HEADER = "x-bl-tpa-client-id";
    private static final String SESSION_TOKEN_HEADER = "x-bl-session-token";

    private final String clientToken;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI sessionUri;
    private final URI orderExportUri;
    private final Object authenticationLock = new Object();

    private volatile String sessionToken;

    @Autowired
    public BrickStoreClient(Env env) {
        this(
                env.getBrickStoreClientToken(),
                HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build(),
                new ObjectMapper(),
                SESSION_URI,
                ORDER_EXPORT_URI
        );
    }

    BrickStoreClient(
            String clientToken,
            HttpClient httpClient,
            ObjectMapper objectMapper,
            URI sessionUri,
            URI orderExportUri
    ) {
        this.clientToken = StringUtils.trimToNull(clientToken);
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.sessionUri = sessionUri;
        this.orderExportUri = orderExportUri;
    }

    /**
     * Downloads BrickLink's XML order export. An empty array means BrickLink reported no matching orders.
     */
    public byte[] exportOrders(OrderExportRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }

        var token = getOrCreateSessionToken();
        var response = sendOrderExport(request, token);
        if (authenticationExpired(response)) {
            invalidateSessionToken(token);
            response = sendOrderExport(request, getOrCreateSessionToken());
        }

        if (isEmptyOrderExport(response)) {
            return new byte[0];
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new BrickStoreClientException(
                    "BrickLink order export failed with HTTP " + response.statusCode() + redirectSuffix(response)
            );
        }
        return response.body();
    }

    private String getOrCreateSessionToken() {
        var current = sessionToken;
        if (current != null) {
            return current;
        }

        synchronized (authenticationLock) {
            if (sessionToken == null) {
                sessionToken = createSessionToken();
            }
            return sessionToken;
        }
    }

    private String createSessionToken() {
        if (clientToken == null) {
            throw new BrickStoreClientException("BRICKSTORE_CLIENT_TOKEN is not configured");
        }

        var payload = new SessionRequest(CLIENT_ID, clientToken);
        final String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BrickStoreClientException("Could not create BrickLink session request", ex);
        }

        var request = HttpRequest.newBuilder(sessionUri)
                .header("Content-Type", "application/json")
                .header(CLIENT_ID_HEADER, CLIENT_ID)
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
        var response = send(request);
        if (response.statusCode() != 200) {
            throw new BrickStoreClientException(
                    "BrickLink session creation failed with HTTP " + response.statusCode()
            );
        }

        try {
            var session = objectMapper.readValue(response.body(), SessionResponse.class);
            if (session == null || StringUtils.isBlank(session.getSessionToken())) {
                throw new BrickStoreClientException("BrickLink session response did not include sessionToken");
            }
            return session.getSessionToken();
        } catch (IOException ex) {
            throw new BrickStoreClientException("Could not parse BrickLink session response", ex);
        }
    }

    private HttpResponse<byte[]> sendOrderExport(OrderExportRequest orderRequest, String token) {
        var request = HttpRequest.newBuilder(orderExportUri)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header(CLIENT_ID_HEADER, CLIENT_ID)
                .header(SESSION_TOKEN_HEADER, token)
                .POST(HttpRequest.BodyPublishers.ofString(formBody(orderRequest), StandardCharsets.UTF_8))
                .build();
        return send(request);
    }

    private HttpResponse<byte[]> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BrickStoreClientException("BrickLink request was interrupted", ex);
        } catch (IOException ex) {
            throw new BrickStoreClientException("BrickLink request failed", ex);
        }
    }

    private String formBody(OrderExportRequest request) {
        var fields = new LinkedHashMap<String, String>();
        putIfNotBlank(fields, "action", request.getAction());
        fields.put("orderType", request.getOrderType().apiValue());
        putIfNotBlank(fields, "viewType", request.getViewType());
        putIfNotBlank(fields, "getStatusSel", request.getGetStatusSel());
        putIfNotBlank(fields, "getFiled", request.getGetFiled());
        putIfNotBlank(fields, "getDetail", request.getGetDetail());
        putIfNotBlank(fields, "getDateFormat", request.getGetDateFormat());
        putIfNotBlank(fields, "includeMyCost", request.getIncludeMyCost());

        if (request.getFromDate() != null) {
            putIfNotBlank(fields, "getOrders", request.getGetOrders());
            addDate(fields, "f", request.getFromDate());
            addDate(fields, "t", request.getToDate());
        } else if (request.getOrderId() != null) {
            fields.put("orderID", request.getOrderId());
        }

        return fields.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(java.util.stream.Collectors.joining("&"));
    }

    private void putIfNotBlank(Map<String, String> fields, String name, String value) {
        if (StringUtils.isNotBlank(value)) {
            fields.put(name, value);
        }
    }

    private void addDate(Map<String, String> fields, String prefix, LocalDate date) {
        fields.put(prefix + "MM", Integer.toString(date.getMonthValue()));
        fields.put(prefix + "DD", Integer.toString(date.getDayOfMonth()));
        fields.put(prefix + "YY", Integer.toString(date.getYear()));
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private boolean authenticationExpired(HttpResponse<?> response) {
        if (response.statusCode() == 401) {
            return true;
        }
        return response.statusCode() == 302
                && response.headers().firstValue("Location")
                .map(location -> location.contains("auth/sign-in?"))
                .orElse(false);
    }

    private boolean isEmptyOrderExport(HttpResponse<?> response) {
        return response.statusCode() == 302
                && response.headers().firstValue("Location")
                .map(location -> location.contains("error=EOF"))
                .orElse(false);
    }

    private void invalidateSessionToken(String rejectedToken) {
        synchronized (authenticationLock) {
            if (rejectedToken.equals(sessionToken)) {
                sessionToken = null;
            }
        }
    }

    private String redirectSuffix(HttpResponse<?> response) {
        return response.headers().firstValue("Location")
                .map(location -> ", redirecting to " + location)
                .orElse("");
    }

    @Getter
    @AllArgsConstructor
    private static class SessionRequest {
        private final String clientId;
        private final String clientToken;
    }

    @Getter
    @NoArgsConstructor
    private static class SessionResponse {
        private String sessionToken;
    }
}
