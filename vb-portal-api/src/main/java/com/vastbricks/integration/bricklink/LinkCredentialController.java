package com.vastbricks.integration.bricklink;

import com.vastbricks.config.Env;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/bricklink")
@CrossOrigin(
    origins = "https://www.bricklink.com",
    originPatterns = "chrome-extension://*",
    allowedHeaders = {"Content-Type", "X-Api-Key"}
)
@RequiredArgsConstructor
public class LinkCredentialController {
    private static final String API_KEY_HEADER = "X-Api-Key";

    private final Env env;
    private final LinkCredentialService service;

    @PostMapping("/session-cookie")
    public LinkCredentialResponse storeSessionCookie(
        @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
        @Valid @RequestBody SessionCookieRequest request) {
        requireApiKey(apiKey);
        return LinkCredentialResponse.from(
            service.store(LinkCredentialType.SESSION_COOKIE, request.getCookie())
        );
    }

    @PostMapping("/token")
    public LinkCredentialResponse storeToken(
        @RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
        @Valid @RequestBody TokenRequest request) {
        requireApiKey(apiKey);
        return LinkCredentialResponse.from(
            service.store(LinkCredentialType.TOKEN, request.getToken())
        );
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatusException(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
    }

    private void requireApiKey(String providedKey) {
        var expectedKey = env.getApiKey();
        if (expectedKey == null || expectedKey.isBlank()) {
            return;
        }
        if (!expectedKey.equals(providedKey)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid API key");
        }
    }

    @Data
    @NoArgsConstructor
    public static class SessionCookieRequest {
        @NotBlank
        private String cookie;
    }

    @Data
    @NoArgsConstructor
    public static class TokenRequest {
        @NotBlank
        private String token;
    }

    @Data
    @AllArgsConstructor
    public static class LinkCredentialResponse {
        private String credentialType;
        private Instant updatedAt;

        static LinkCredentialResponse from(LinkCredential credential) {
            return new LinkCredentialResponse(
                credential.getCredentialType().name(),
                credential.getUpdatedAt()
            );
        }
    }
}
