package com.vastbricks.api.client.brickstore;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.xml.XmlFactory;
import com.fasterxml.jackson.dataformat.xml.XmlMapper;
import com.vastbricks.api.tor.TorRestClientFactory;
import com.vastbricks.api.tor.TorRestClientOptions;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import javax.xml.stream.XMLInputFactory;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class BrickStoreClient {

    private static final String CLIENT_ID = "ca629c09-4d8c-45dc-8a6f-bfb2b058f720";
    private static final String CLIENT_ID_HEADER = "x-bl-tpa-client-id";
    private static final String SESSION_TOKEN_HEADER = "x-bl-session-token";
    private static final String SESSION_PATH = "/api/v1/actions/verify-and-create-session";
    private static final String ORDER_EXPORT_PATH = "/orderExcelFinal.asp";

    private final BrickStoreSettings settings;
    private final RestClient simpleRestClient;
    private final RestClient torRestClient;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final XmlMapper xmlMapper = createXmlMapper();
    private final Object authenticationLock = new Object();

    private volatile String sessionToken;
    private volatile String sessionClientToken;

    BrickStoreClient(BrickStoreSettings settings, TorRestClientFactory torRestClientFactory) {
        this.settings = settings;
        this.simpleRestClient = RestClient.builder().build();
        this.torRestClient = torRestClientFactory.create(TorRestClientOptions.builder()
                .retryStatus(org.springframework.http.HttpStatus.METHOD_NOT_ALLOWED)
                .retryStatus(org.springframework.http.HttpStatus.FORBIDDEN)
                .build());
    }

    public List<BrickStoreOrder> listOrders(BrickStoreOrderExportRequest request) {
        validateOrderListRequest(request);
        return parseOrderExport(exportOrders(request));
    }

    public byte[] exportOrders(BrickStoreOrderExportRequest request) {
        Objects.requireNonNull(request, "request");
        var response = sendOrderExportWithToken(request);
        if (authenticationExpired(response)) {
            invalidateSessionToken(response.sessionToken);
            response = sendOrderExportWithToken(request);
        }
        return bodyOrThrow(response);
    }

    private BrickStoreResponse sendOrderExportWithToken(BrickStoreOrderExportRequest orderRequest) {
        var token = getOrCreateSessionToken();
        var response = postOrderExport(orderRequest, token);
        response.sessionToken = token;
        return response;
    }

    private String getOrCreateSessionToken() {
        var clientToken = configuredClientToken();
        var current = sessionToken;
        if (current != null && clientToken.equals(sessionClientToken)) {
            return current;
        }

        synchronized (authenticationLock) {
            if (sessionToken == null || !clientToken.equals(sessionClientToken)) {
                sessionToken = createSessionToken(clientToken);
                sessionClientToken = clientToken;
            }
            return sessionToken;
        }
    }

    private void invalidateSessionToken(String rejectedToken) {
        synchronized (authenticationLock) {
            if (rejectedToken != null && rejectedToken.equals(sessionToken)) {
                sessionToken = null;
                sessionClientToken = null;
            }
        }
    }

    void invalidateSessionToken() {
        synchronized (authenticationLock) {
            sessionToken = null;
            sessionClientToken = null;
        }
    }

    private String configuredClientToken() {
        var token = settings.getToken();
        if (token == null || token.isBlank()) {
            throw new BrickStoreClientException("BrickStore token is not configured");
        }
        return token.trim();
    }

    private String createSessionToken(String clientToken) {
        String body;
        try {
            body = objectMapper.writeValueAsString(new SessionRequest(CLIENT_ID, clientToken));
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new BrickStoreClientException("Could not create BrickStore session request", ex);
        }

        var response = exchange(() -> restClient().post()
                .uri(resolveSession(SESSION_PATH))
                .contentType(MediaType.APPLICATION_JSON)
                .header(CLIENT_ID_HEADER, CLIENT_ID)
                .body(body)
                .exchange((request, rawResponse) -> new BrickStoreResponse(
                        rawResponse.getStatusCode().value(),
                        rawResponse.getHeaders(),
                        rawResponse.getBody().readAllBytes()
                )), "BrickStore session creation failed");

        if (response.statusCode != 200) {
            throw new BrickStoreClientException("BrickStore session creation failed with HTTP " + response.statusCode);
        }

        try {
            var session = objectMapper.readValue(response.body, SessionResponse.class);
            if (session == null || session.getSessionToken() == null || session.getSessionToken().isBlank()) {
                throw new BrickStoreClientException("BrickStore session response did not include sessionToken");
            }
            return session.getSessionToken();
        } catch (IOException ex) {
            throw new BrickStoreClientException("Could not parse BrickStore session response", ex);
        }
    }

    private BrickStoreResponse postOrderExport(BrickStoreOrderExportRequest orderRequest, String token) {
        var body = formBody(orderRequest);
        return exchange(() -> restClient().post()
                .uri(resolve(ORDER_EXPORT_PATH))
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .header(CLIENT_ID_HEADER, CLIENT_ID)
                .header(SESSION_TOKEN_HEADER, token)
                .body(body)
                .exchange((request, rawResponse) -> new BrickStoreResponse(
                        rawResponse.getStatusCode().value(),
                        rawResponse.getHeaders(),
                        rawResponse.getBody().readAllBytes()
                )), "BrickStore order export request failed");
    }

    private BrickStoreResponse exchange(BrickStoreExchange request, String failureMessage) {
        try {
            return request.execute();
        } catch (RestClientException ex) {
            throw new BrickStoreClientException(failureMessage, ex);
        } catch (IOException ex) {
            throw new BrickStoreClientException(failureMessage, ex);
        }
    }

    private RestClient restClient() {
        return settings.isTorEnabled() ? torRestClient : simpleRestClient;
    }

    private URI resolve(String path) {
        return URI.create(settings.getBaseUrl()).resolve(path);
    }

    private URI resolveSession(String path) {
        return URI.create(settings.getSessionBaseUrl()).resolve(path);
    }

    private void validateOrderListRequest(BrickStoreOrderExportRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }
        if (!"X".equalsIgnoreCase(request.getViewType())) {
            throw new IllegalArgumentException("viewType must be X for an XML order export");
        }
    }

    private List<BrickStoreOrder> parseOrderExport(byte[] xml) {
        if (xml.length == 0) {
            return List.of();
        }
        try {
            var export = xmlMapper.readValue(xml, BrickStoreOrderExport.class);
            return export.getOrders() == null ? List.of() : List.copyOf(export.getOrders());
        } catch (IOException ex) {
            throw new BrickStoreClientException("Could not parse BrickStore order export XML", ex);
        }
    }

    private byte[] bodyOrThrow(BrickStoreResponse response) {
        if (isEmptyOrderExport(response)) {
            return new byte[0];
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new BrickStoreClientException(
                    "BrickStore order export failed with HTTP " + response.statusCode + redirectSuffix(response)
            );
        }
        return response.body == null ? new byte[0] : response.body;
    }

    private String formBody(BrickStoreOrderExportRequest request) {
        var fields = new LinkedHashMap<String, String>();
        putIfNotBlank(fields, "action", request.getAction());
        fields.put("orderType", request.getOrderType().name().toLowerCase(Locale.ROOT));
        putIfNotBlank(fields, "viewType", request.getViewType());
        putIfNotBlank(fields, "getOrders", request.getGetOrders());

        if (request.getFromDate() != null) {
            addDate(fields, "f", request.getFromDate());
            addDate(fields, "t", request.getToDate());
        }

        putIfNotBlank(fields, "getStatusSel", request.getGetStatusSel());
        putIfNotBlank(fields, "getFiled", request.getGetFiled());
        putIfNotBlank(fields, "getDetail", request.getGetDetail());
        putIfNotBlank(fields, "useRealName", request.getUseRealName());
        putIfNotBlank(fields, "orderID", request.getOrderId());
        putIfNotBlank(fields, "getDateFormat", request.getGetDateFormat());
        putIfNotBlank(fields, "locType", request.getLocType());
        putIfNotBlank(fields, "locCountryID", request.getLocCountryId());
        putIfNotBlank(fields, "includeMyCost", request.getIncludeMyCost());

        return fields.entrySet().stream()
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .collect(java.util.stream.Collectors.joining("&"));
    }

    private void putIfNotBlank(Map<String, String> fields, String name, String value) {
        if (value != null && !value.isBlank()) {
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

    private boolean authenticationExpired(BrickStoreResponse response) {
        if (response.statusCode == 401) {
            return true;
        }
        return response.statusCode == 302
                && response.headers.getFirst(HttpHeaders.LOCATION) != null
                && response.headers.getFirst(HttpHeaders.LOCATION).contains("auth/sign-in?");
    }

    private boolean isEmptyOrderExport(BrickStoreResponse response) {
        return response.statusCode == 302
                && response.headers.getFirst(HttpHeaders.LOCATION) != null
                && response.headers.getFirst(HttpHeaders.LOCATION).contains("error=EOF");
    }

    private String redirectSuffix(BrickStoreResponse response) {
        var location = response.headers.getFirst(HttpHeaders.LOCATION);
        return location == null ? "" : ", redirecting to " + location;
    }

    private static XmlMapper createXmlMapper() {
        var inputFactory = XMLInputFactory.newFactory();
        inputFactory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        inputFactory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        return new XmlMapper(new XmlFactory(inputFactory));
    }

    @FunctionalInterface
    private interface BrickStoreExchange {
        BrickStoreResponse execute() throws IOException;
    }

    @Getter
    @AllArgsConstructor
    private static class BrickStoreResponse {
        private final int statusCode;
        private final HttpHeaders headers;
        private final byte[] body;
        private String sessionToken;

        BrickStoreResponse(int statusCode, HttpHeaders headers, byte[] body) {
            this.statusCode = statusCode;
            this.headers = headers;
            this.body = body;
        }
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
