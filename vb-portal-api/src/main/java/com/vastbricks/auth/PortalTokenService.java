package com.vastbricks.auth;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class PortalTokenService {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final Duration TOKEN_LIFETIME = Duration.ofHours(12);
    private static final String JWT_HEADER = encodeBytes("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    private final ObjectMapper objectMapper;
    private final byte[] signingKey;

    public PortalTokenService(ObjectMapper objectMapper, Env env) {
        this.objectMapper = objectMapper;
        var secret = env.getPortalJwtSecret();
        if (StringUtils.isBlank(secret) || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("PORTAL_JWT_SECRET must contain at least 32 bytes");
        }
        this.signingKey = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String createToken(PortalUser user) {
        var now = Instant.now();
        var claims = new LinkedHashMap<String, Object>();
        claims.put("iss", "vastbricks-portal");
        claims.put("sub", user.getId().toString());
        claims.put("email", user.getEmail());
        claims.put("name", user.getName());
        claims.put("role", user.getRole());
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", now.plus(TOKEN_LIFETIME).getEpochSecond());

        try {
            var payload = encodeBytes(objectMapper.writeValueAsBytes(claims));
            var unsignedToken = JWT_HEADER + "." + payload;
            return unsignedToken + "." + encodeBytes(sign(unsignedToken));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to create portal token", e);
        }
    }

    public Long verifyAndGetUserId(String token) {
        try {
            var parts = token.split("\\.", -1);
            if (parts.length != 3 || !JWT_HEADER.equals(parts[0])) {
                throw new InvalidTokenException();
            }

            var unsignedToken = parts[0] + "." + parts[1];
            if (!MessageDigest.isEqual(sign(unsignedToken), DECODER.decode(parts[2]))) {
                throw new InvalidTokenException();
            }

            Map<String, Object> claims = objectMapper.readValue(DECODER.decode(parts[1]), new TypeReference<>() { });
            if (!"vastbricks-portal".equals(claims.get("iss"))) {
                throw new InvalidTokenException();
            }

            var expiresAt = ((Number) claims.get("exp")).longValue();
            if (expiresAt <= Instant.now().getEpochSecond()) {
                throw new InvalidTokenException();
            }

            return Long.valueOf(claims.get("sub").toString());
        } catch (InvalidTokenException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidTokenException();
        }
    }

    private byte[] sign(String value) {
        try {
            var mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
            return mac.doFinal(value.getBytes(StandardCharsets.US_ASCII));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC-SHA256 is unavailable", e);
        }
    }

    private static String encodeBytes(byte[] value) {
        return ENCODER.encodeToString(value);
    }

    public static class InvalidTokenException extends RuntimeException {
    }
}
