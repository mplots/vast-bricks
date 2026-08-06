package com.vastbricks.integration.bricklink;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class LinkInternalClient {
    private static final LinkAuthenticationMode PRIMARY_AUTHENTICATION_MODE = LinkAuthenticationMode.TOKEN;
    private static final URI ORDER_EXPORT_URI = URI.create("https://www.bricklink.com/orderExcelFinal.asp");

    private final LinkCredentialService credentialService;
    private final LinkTokenAuthenticator tokenAuthenticator;
    private final HttpClient httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    private final RestTemplate restTemplate = new RestTemplate();
    private final URI orderExportUri = ORDER_EXPORT_URI;

    /**
     * Downloads BrickLink's XML order export. An empty array means BrickLink reported no matching orders.
     */
    public byte[] exportOrders(OrderExportRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("request is required");
        }

        var failures = new ArrayList<String>();
        for (var mode : authenticationModes()) {
            try {
                var response = sendOrderExport(request, mode);
                if (authenticationExpired(response)) {
                    failures.add(mode + " failed: " + responseSummary(response));
                    continue;
                }
                return bodyOrThrow(response);
            } catch (LinkAuthenticationException ex) {
                failures.add(mode + " failed: " + ex.getMessage());
            }
        }

        throw new LinkInternalClientException(
            "BrickLink order export authentication failed. " + String.join("; ", failures)
        );
    }

    private LinkResponse sendOrderExport(OrderExportRequest request, LinkAuthenticationMode mode) {
        return switch (mode) {
            case SESSION_COOKIE -> sendOrderExportWithSessionCookie(request);
            case TOKEN -> sendOrderExportWithToken(request);
        };
    }

    private LinkResponse sendOrderExportWithSessionCookie(OrderExportRequest orderRequest) {
        var cookie = credentialService.findValue(LinkCredentialType.SESSION_COOKIE)
            .orElseThrow(() -> new LinkAuthenticationException("BrickLink session cookie is not configured"));

        var headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);
        headers.add(HttpHeaders.CONTENT_TYPE, "application/x-www-form-urlencoded");
        var response = restTemplate.exchange(
            orderExportUri,
            HttpMethod.POST,
            new HttpEntity<>(formBody(orderRequest), headers),
            byte[].class
        );
        return new LinkResponse(response.getStatusCode().value(), response.getHeaders(), response.getBody());
    }

    private LinkResponse sendOrderExportWithToken(OrderExportRequest orderRequest) {
        var token = tokenAuthenticator.getOrCreateSessionToken();
        var response = sendOrderExportWithSessionToken(orderRequest, token);
        if (authenticationExpired(response)) {
            tokenAuthenticator.invalidateSessionToken(token);
            response = sendOrderExportWithSessionToken(orderRequest, tokenAuthenticator.getOrCreateSessionToken());
        }
        return response;
    }

    private LinkResponse sendOrderExportWithSessionToken(OrderExportRequest orderRequest, String token) {
        var request = HttpRequest.newBuilder(orderExportUri)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .header(LinkTokenAuthenticator.CLIENT_ID_HEADER, LinkTokenAuthenticator.CLIENT_ID)
            .header(LinkTokenAuthenticator.SESSION_TOKEN_HEADER, token)
            .POST(HttpRequest.BodyPublishers.ofString(formBody(orderRequest), StandardCharsets.UTF_8))
            .build();
        return send(request);
    }

    private byte[] bodyOrThrow(LinkResponse response) {
        if (isEmptyOrderExport(response)) {
            return new byte[0];
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new LinkInternalClientException(
                "BrickLink order export failed with HTTP " + response.statusCode + redirectSuffix(response)
            );
        }
        return response.body;
    }

    private LinkResponse send(HttpRequest request) {
        try {
            var response = httpClient.send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            var headers = new HttpHeaders();
            response.headers().map().forEach(headers::addAll);
            return new LinkResponse(response.statusCode(), headers, response.body());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new LinkInternalClientException("BrickLink request was interrupted", ex);
        } catch (IOException ex) {
            throw new LinkInternalClientException("BrickLink request failed", ex);
        }
    }

    private String formBody(OrderExportRequest request) {
        var fields = new LinkedHashMap<String, String>();
        putIfNotBlank(fields, "action", request.getAction());
        fields.put("orderType", request.getOrderType().name().toLowerCase(Locale.ROOT));
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

    private List<LinkAuthenticationMode> authenticationModes() {
        var fallbackMode = PRIMARY_AUTHENTICATION_MODE == LinkAuthenticationMode.SESSION_COOKIE
            ? LinkAuthenticationMode.TOKEN
            : LinkAuthenticationMode.SESSION_COOKIE;
        return List.of(PRIMARY_AUTHENTICATION_MODE, fallbackMode);
    }

    private boolean authenticationExpired(LinkResponse response) {
        if (response.statusCode == 401) {
            return true;
        }
        return response.statusCode == 302
            && response.headers.getFirst(HttpHeaders.LOCATION) != null
            && response.headers.getFirst(HttpHeaders.LOCATION)
            .contains("auth/sign-in?");
    }

    private boolean isEmptyOrderExport(LinkResponse response) {
        return response.statusCode == 302
            && response.headers.getFirst(HttpHeaders.LOCATION) != null
            && response.headers.getFirst(HttpHeaders.LOCATION)
            .contains("error=EOF");
    }

    private String redirectSuffix(LinkResponse response) {
        var location = response.headers.getFirst(HttpHeaders.LOCATION);
        return location == null ? "" : ", redirecting to " + location;
    }

    private String responseSummary(LinkResponse response) {
        return "HTTP " + response.statusCode + redirectSuffix(response);
    }

    @Getter
    @AllArgsConstructor
    private static class LinkResponse {
        private final int statusCode;
        private final HttpHeaders headers;
        private final byte[] body;
    }
}
