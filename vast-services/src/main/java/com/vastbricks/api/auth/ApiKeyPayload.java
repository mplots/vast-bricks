package com.vastbricks.api.auth;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Every request and response body of the API key feature. Public because {@link ApiKeyController} is. */
public final class ApiKeyPayload {

    private ApiKeyPayload() {
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static final class CreateApiKeyRequest {
        /** What the key is for, so the owner can tell which program to stop when they revoke it. */
        private String name;
        /** How long the key lasts. Absent or non-positive never expires, which is what a running program needs. */
        private Integer expiresInDays;
    }

    /** A key as a list of them shows it: everything but the secret, which no read ever returns. */
    @Getter
    @AllArgsConstructor
    public static class ApiKeyItem {
        private Long id;
        private String name;
        /** The opening characters of the secret, the same fragment the external program shows. */
        private String tokenPrefix;
        private Instant createdAt;
        private Instant expiresAt;
        private Instant lastUsedAt;
        /** Whether it has stopped authenticating. A revoked key is deleted, so only expiry can retire one here. */
        private boolean expired;
    }

    /**
     * The one response that carries the secret. It is returned at generation and never again, because only its hash
     * is stored - a key that cannot be copied now has to be replaced rather than recovered.
     */
    @Getter
    public static final class GeneratedApiKey extends ApiKeyItem {

        private final String token;

        GeneratedApiKey(ApiKeyItem item, String token) {
            super(item.getId(), item.getName(), item.getTokenPrefix(), item.getCreatedAt(), item.getExpiresAt(),
                    item.getLastUsedAt(), item.isExpired());
            this.token = token;
        }
    }
}
