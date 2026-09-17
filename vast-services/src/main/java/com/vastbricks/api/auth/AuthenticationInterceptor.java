package com.vastbricks.api.auth;

import com.vastbricks.api.tenancy.TenantAccess;
import com.vastbricks.api.tenancy.TenantContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Resolves who is asking and binds the tenant they serve, for every request that carries a token or an API key.
 *
 * <p>It does not reject: enforcement is {@link PrivateApiInterceptor}'s job on {@code /api/private/**}. The two are
 * separate because a request can carry a token without being private — the test endpoints do, and they need the
 * tenant that token selected.
 *
 * <p>Two credentials resolve the same way. A {@code Bearer} token is a person's login, and says which of their
 * tenants they picked; an {@code X-Api-Key} is a program's, and names the one tenant it was generated for. Either
 * ends as the same user and tenant, so nothing downstream has to know which was presented.
 *
 * <p>A request with no usable credential gets no tenant, rather than some tenant chosen on its behalf. It then reads
 * nothing and writes nowhere, which is the only honest answer to a request that never said who it was for.
 */
@Component
@RequiredArgsConstructor
class AuthenticationInterceptor implements HandlerInterceptor {

    static final String AUTHENTICATED_USER_ATTRIBUTE = "vastAuthenticatedUser";

    private static final String API_KEY_HEADER = "X-Api-Key";
    private static final String BEARER_PREFIX = "Bearer ";

    private final TokenService tokenService;
    private final AuthenticationService authenticationService;
    private final TenantAccess tenantAccess;
    private final ApiKeyService apiKeyService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        TenantContext.setTenantId(resolveTenantId(request));
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        TenantContext.clear();
    }

    private Long resolveTenantId(HttpServletRequest request) {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith(BEARER_PREFIX)) {
            return resolveToken(request, authorization.substring(BEARER_PREFIX.length()));
        }

        String apiKey = request.getHeader(API_KEY_HEADER);
        if (apiKey != null && !apiKey.isBlank()) {
            return resolveApiKey(request, apiKey);
        }
        return null;
    }

    private Long resolveToken(HttpServletRequest request, String token) {
        try {
            TokenService.Principal principal = tokenService.verifyAndGetPrincipal(token);
            return bind(request, principal.getUserId(), principal.getTenantId());
        } catch (TokenService.InvalidTokenException exception) {
            return null;
        }
    }

    private Long resolveApiKey(HttpServletRequest request, String presentedKey) {
        return apiKeyService.resolve(presentedKey)
                .map(apiKey -> bind(request, apiKey.getUserId(), apiKey.getTenantId()))
                .orElse(null);
    }

    /**
     * Binds the user a credential named, provided they are still active and may still serve the tenant it named.
     * Membership is asked here rather than trusted from the credential, so revoking it stops both a token and a key
     * working at once instead of when they expire - and a key with no expiry has nothing else to stop it.
     */
    private Long bind(HttpServletRequest request, Long userId, Long tenantId) {
        User user = authenticationService.findActiveById(userId).orElse(null);
        if (user == null || !tenantAccess.canServe(userId, tenantId)) {
            return null;
        }

        request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, user);
        return tenantId;
    }
}
