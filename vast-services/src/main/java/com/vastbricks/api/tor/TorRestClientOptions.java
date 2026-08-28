package com.vastbricks.api.tor;

import lombok.Builder;
import lombok.Getter;
import lombok.Singular;
import org.springframework.http.HttpStatusCode;

import java.util.Collections;
import java.util.Set;

@Getter
@Builder(toBuilder = true)
public class TorRestClientOptions {

    public static final int DEFAULT_MAX_REQUESTS_BEFORE_NEW_CIRCUIT = 50;
    public static final int DEFAULT_MAX_RETRY_ATTEMPTS = 200;

    @Builder.Default
    private final boolean preserveCookies = false;

    @Singular
    private final Set<HttpStatusCode> retryStatuses;

    @Builder.Default
    private final int maxRequestsBeforeNewCircuit = DEFAULT_MAX_REQUESTS_BEFORE_NEW_CIRCUIT;

    @Builder.Default
    private final int maxRetryAttempts = DEFAULT_MAX_RETRY_ATTEMPTS;

    static TorRestClientOptions defaults(Set<Integer> retryStatuses) {
        return TorRestClientOptions.builder()
                .retryStatuses(retryStatuses.stream()
                        .map(HttpStatusCode::valueOf)
                        .collect(java.util.stream.Collectors.toUnmodifiableSet()))
                .build();
    }

    public Set<HttpStatusCode> getRetryStatuses() {
        return retryStatuses == null ? Collections.emptySet() : retryStatuses;
    }

    public int getMaxRequestsBeforeNewCircuit() {
        return maxRequestsBeforeNewCircuit;
    }

    public int getMaxRetryAttempts() {
        return maxRetryAttempts;
    }
}
