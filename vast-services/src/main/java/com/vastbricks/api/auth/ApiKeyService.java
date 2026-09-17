package com.vastbricks.api.auth;

import com.vastbricks.api.auth.ApiKeyPayload.ApiKeyItem;
import com.vastbricks.api.auth.ApiKeyPayload.CreateApiKeyRequest;
import com.vastbricks.api.auth.ApiKeyPayload.GeneratedApiKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Generating, listing, revoking and resolving the keys an external program authenticates with.
 *
 * <p>A key is 256 random bits behind a {@code vb_} marker, returned once and kept only as a SHA-256. Plain SHA-256
 * rather than a password hash is the right hash here: the secret is random rather than chosen, so there is nothing to
 * guess faster than the key space, and resolution happens on every request a program makes.
 */
@Service
@RequiredArgsConstructor
class ApiKeyService {

    /** Marks a Vast key wherever it turns up - a config file, a log, a support question - as ours and as a secret. */
    static final String TOKEN_MARKER = "vb_";
    /** Enough of the secret to tell two keys apart, and far too little to narrow down either. */
    static final int PREFIX_LENGTH = TOKEN_MARKER.length() + 8;
    private static final int SECRET_BYTES = 32;
    private static final int MAX_KEYS_PER_TENANT = 50;
    /** How stale {@code last_used_at} may get, so a busy program costs one write a minute rather than one a call. */
    private static final Duration LAST_USED_RESOLUTION = Duration.ofMinutes(1);

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();

    private final ApiKeyRepository apiKeyRepository;

    @Transactional
    GeneratedApiKey createApiKey(Long userId, Long tenantId, CreateApiKeyRequest request) {
        String name = StringUtils.trimToEmpty(request.getName());
        if (name.isEmpty()) {
            throw new ApiKeyException("A key needs a name, so it can be told apart from the others.");
        }
        if (name.length() > 200) {
            throw new ApiKeyException("A key name can be at most 200 characters.");
        }
        if (apiKeyRepository.existsByUserIdAndTenantIdAndNameIgnoreCase(userId, tenantId, name)) {
            throw new ApiKeyException("A key named '" + name + "' already exists.");
        }
        if (apiKeyRepository.findByUserIdAndTenantIdOrderByIdAsc(userId, tenantId).size() >= MAX_KEYS_PER_TENANT) {
            throw new ApiKeyException("This account already holds " + MAX_KEYS_PER_TENANT + " keys for this store. "
                    + "Revoke one that is no longer used.");
        }

        String token = TOKEN_MARKER + ENCODER.encodeToString(randomBytes());
        ApiKey apiKey = new ApiKey(
                userId,
                tenantId,
                name,
                hash(token),
                token.substring(0, PREFIX_LENGTH),
                expiryFrom(request.getExpiresInDays())
        );
        return new GeneratedApiKey(toItem(apiKeyRepository.save(apiKey)), token);
    }

    @Transactional(readOnly = true)
    List<ApiKeyItem> listApiKeys(Long userId, Long tenantId) {
        return apiKeyRepository.findByUserIdAndTenantIdOrderByIdAsc(userId, tenantId).stream()
                .map(ApiKeyService::toItem)
                .toList();
    }

    /**
     * Revokes a key outright. Deleting rather than deactivating, because a revoked key has nothing left worth
     * keeping: its secret was never stored, so there is no row to inspect afterwards and nothing to un-revoke.
     */
    @Transactional
    void deleteApiKey(Long userId, Long tenantId, Long id) {
        ApiKey apiKey = apiKeyRepository.findByIdAndUserIdAndTenantId(id, userId, tenantId)
                .orElseThrow(() -> new ApiKeyNotFoundException("No such key."));
        apiKeyRepository.delete(apiKey);
    }

    /**
     * Who a presented key says is asking, or empty when it says nothing usable.
     *
     * <p>Deliberately not scoped to a tenant: this is the lookup that decides which tenant the request serves, so
     * there is none bound yet. Membership is still checked by the caller on every request, exactly as it is for a
     * login token, so a membership taken away stops the key working at once.
     */
    @Transactional
    Optional<ApiKey> resolve(String presentedToken) {
        String token = StringUtils.trimToEmpty(presentedToken);
        if (!token.startsWith(TOKEN_MARKER)) {
            return Optional.empty();
        }

        Instant now = Instant.now();
        return apiKeyRepository.findByTokenHash(hash(token))
                .filter(apiKey -> !apiKey.isExpired(now))
                .map(apiKey -> touch(apiKey, now));
    }

    private ApiKey touch(ApiKey apiKey, Instant now) {
        Instant lastUsed = apiKey.getLastUsedAt();
        if (lastUsed == null || lastUsed.isBefore(now.minus(LAST_USED_RESOLUTION))) {
            apiKey.setLastUsedAt(now);
        }
        return apiKey;
    }

    private static Instant expiryFrom(Integer expiresInDays) {
        if (expiresInDays == null || expiresInDays <= 0) {
            return null;
        }
        return Instant.now().plus(expiresInDays, ChronoUnit.DAYS);
    }

    private static byte[] randomBytes() {
        byte[] secret = new byte[SECRET_BYTES];
        RANDOM.nextBytes(secret);
        return secret;
    }

    private static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static ApiKeyItem toItem(ApiKey apiKey) {
        return new ApiKeyItem(
                apiKey.getId(),
                apiKey.getName(),
                apiKey.getTokenPrefix(),
                apiKey.getCreatedAt(),
                apiKey.getExpiresAt(),
                apiKey.getLastUsedAt(),
                apiKey.isExpired(Instant.now())
        );
    }
}
