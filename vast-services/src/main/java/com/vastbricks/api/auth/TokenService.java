package com.vastbricks.api.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;

@Service
class TokenService {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(12);
    private static final String JWT_HEADER = encodeBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    private final ObjectMapper objectMapper;
    private final byte[] signingKey;

    TokenService(ObjectMapper objectMapper, AuthSettings settings) {
        this.objectMapper = objectMapper;
        String secret = settings.getJwtSecret();
        if (secret == null || secret.isBlank() || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("VAST_AUTH_JWT_SECRET must contain at least 32 bytes");
        }
        this.signingKey = secret.getBytes(StandardCharsets.UTF_8);
    }

    String createToken(User user) {
        Instant now = Instant.now();
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", "vastbricks-portal");
        claims.put("sub", user.getId().toString());
        claims.put("email", user.getEmail());
        claims.put("name", user.getName());
        claims.put("role", user.getRole());
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", now.plus(TOKEN_LIFETIME).getEpochSecond());

        try {
            String payload = encodeBytes(objectMapper.writeValueAsBytes(claims));
            String unsignedToken = JWT_HEADER + "." + payload;
            return unsignedToken + "." + encodeBytes(sign(unsignedToken));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to create authentication token", exception);
        }
    }

    Long verifyAndGetUserId(String token) {
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3 || !JWT_HEADER.equals(parts[0])) {
                throw new InvalidTokenException();
            }

            String unsignedToken = parts[0] + "." + parts[1];
            if (!MessageDigest.isEqual(sign(unsignedToken), DECODER.decode(parts[2]))) {
                throw new InvalidTokenException();
            }

            Map<String, Object> claims = objectMapper.readValue(DECODER.decode(parts[1]), new TypeReference<>() { });
            if (!"vastbricks-portal".equals(claims.get("iss"))) {
                throw new InvalidTokenException();
            }

            long expiresAt = ((Number) claims.get("exp")).longValue();
            if (expiresAt <= Instant.now().getEpochSecond()) {
                throw new InvalidTokenException();
            }

            return Long.valueOf(claims.get("sub").toString());
        } catch (InvalidTokenException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new InvalidTokenException();
        }
    }

    private byte[] sign(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", exception);
        }
    }

    private static String encodeBytes(byte[] value) {
        return ENCODER.encodeToString(value);
    }

    static class InvalidTokenException extends RuntimeException {
    }
}
