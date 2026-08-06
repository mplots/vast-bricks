package com.vastbricks.integration.bricklink;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;

@Component
@RequiredArgsConstructor
public class LinkTokenAuthenticator {
    static final String CLIENT_ID = "ca629c09-4d8c-45dc-8a6f-bfb2b058f720";
    static final String CLIENT_ID_HEADER = "x-bl-tpa-client-id";
    static final String SESSION_TOKEN_HEADER = "x-bl-session-token";

    private static final URI SESSION_URI = URI.create(
            "https://account.prod.member.bricklink.info/api/v1/actions/verify-and-create-session"
    );

    private final LinkCredentialService credentialService;
    private final HttpClient httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final URI sessionUri = SESSION_URI;
    private final Object authenticationLock = new Object();

    private volatile String sessionToken;

    public String getOrCreateSessionToken() {
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

    public void invalidateSessionToken(String rejectedToken) {
        synchronized (authenticationLock) {
            if (rejectedToken.equals(sessionToken)) {
                sessionToken = null;
            }
        }
    }

    private String createSessionToken() {
        var clientToken = credentialService.findValue(LinkCredentialType.TOKEN)
            .orElseThrow(() -> new LinkAuthenticationException("BrickLink token is not configured"));

        var payload = new SessionRequest(CLIENT_ID, clientToken);
        final String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new LinkInternalClientException("Could not create BrickLink session request", ex);
        }

        var request = HttpRequest.newBuilder(sessionUri)
            .header("Content-Type", "application/json")
            .header(CLIENT_ID_HEADER, CLIENT_ID)
            .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
            .build();
        var response = send(request);
        if (response.statusCode() != 200) {
            throw new LinkAuthenticationException(
                "BrickLink session creation failed with HTTP " + response.statusCode()
            );
        }

        try {
            var session = objectMapper.readValue(response.body(), SessionResponse.class);
            if (session == null || StringUtils.isBlank(session.getSessionToken())) {
                throw new LinkInternalClientException("BrickLink session response did not include sessionToken");
            }
            return session.getSessionToken();
        } catch (IOException ex) {
            throw new LinkInternalClientException("Could not parse BrickLink session response", ex);
        }
    }

    private HttpResponse<byte[]> send(HttpRequest request) {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new LinkInternalClientException("BrickLink request was interrupted", ex);
        } catch (IOException ex) {
            throw new LinkInternalClientException("BrickLink request failed", ex);
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
