package com.vastbricks.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Dummy auth endpoints so the portal can log in without a real identity provider.
 */
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String DEFAULT_EMAIL = "demo@vastbricks.com";

    private final ObjectMapper objectMapper;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        var email = StringUtils.defaultIfBlank(request.email(), DEFAULT_EMAIL).trim();
        var user = new UserProfile(request.id(), email, "Demo User", "admin");
        var token = buildUnsignedJwt(email);
        return new LoginResponse(token, user);
    }

    @GetMapping("/me")
    public UserResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing bearer token");
        }
        var token = authorization.substring("Bearer ".length());
        var email = decodeEmail(token);
        return new UserResponse(new UserProfile(null, email, "Demo User", "admin"));
    }

    @PostMapping("/register")
    public List<UserProfile> register(@RequestBody RegisterRequest request) {
        var fullName = (StringUtils.defaultString(request.firstName()) + " " + StringUtils.defaultString(request.lastName())).trim();
        var name = StringUtils.isNotBlank(fullName) ? fullName : "Demo User";
        var email = StringUtils.defaultIfBlank(request.email(), DEFAULT_EMAIL).trim();
        return List.of(new UserProfile(request.id(), email, name, "admin"));
    }

    private String buildUnsignedJwt(String email) {
        var header = Map.of("alg", "none", "typ", "JWT");
        var now = Instant.now();
        var payload = Map.of(
                "sub", email,
                "email", email,
                "iat", now.getEpochSecond(),
                "exp", now.plus(Duration.ofDays(30)).getEpochSecond()
        );

        try {
            return encode(header) + "." + encode(payload) + ".";
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to create demo token", e);
        }
    }

    private String encode(Object data) throws JsonProcessingException {
        return ENCODER.encodeToString(objectMapper.writeValueAsString(data).getBytes(StandardCharsets.UTF_8));
    }

    private String decodeEmail(String token) {
        try {
            var parts = token.split("\\.");
            if (parts.length < 2) {
                return DEFAULT_EMAIL;
            }
            var json = new String(DECODER.decode(parts[1]), StandardCharsets.UTF_8);
            var payload = objectMapper.readValue(json, Map.class);
            var email = payload.getOrDefault("email", payload.get("sub"));
            return email != null ? email.toString() : DEFAULT_EMAIL;
        } catch (Exception e) {
            return DEFAULT_EMAIL;
        }
    }

    public record LoginRequest(Long id, String email, String password) { }

    public record RegisterRequest(Long id, String email, String password, String firstName, String lastName) { }

    public record LoginResponse(String serviceToken, UserProfile user) { }

    public record UserResponse(UserProfile user) { }

    public record UserProfile(Long id, String email, String name, String role) { }
}
