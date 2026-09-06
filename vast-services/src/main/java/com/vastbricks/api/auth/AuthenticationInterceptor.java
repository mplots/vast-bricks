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
 * Resolves who is asking and binds the tenant they serve, for every request that carries a token.
 *
 * <p>It does not reject: enforcement is {@link PrivateApiInterceptor}'s job on {@code /api/private/**}. The two are
 * separate because a request can carry a token without being private — the test endpoints do, and they need the
 * tenant that token selected.
 *
 * <p>A request with no usable token gets no tenant, rather than some tenant chosen on its behalf. It then reads
 * nothing and writes nowhere, which is the only honest answer to a request that never said who it was for.
 */
@Component
@RequiredArgsConstructor
class AuthenticationInterceptor implements HandlerInterceptor {

    static final String AUTHENTICATED_USER_ATTRIBUTE = "vastAuthenticatedUser";

    private final TokenService tokenService;
    private final AuthenticationService authenticationService;
    private final TenantAccess tenantAccess;

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
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }

        try {
            TokenService.Principal principal = tokenService.verifyAndGetPrincipal(authorization.substring("Bearer ".length()));
            User user = authenticationService.findActiveById(principal.getUserId()).orElse(null);
            if (user == null || !tenantAccess.canServe(principal.getUserId(), principal.getTenantId())) {
                return null;
            }

            request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, user);
            return principal.getTenantId();
        } catch (TokenService.InvalidTokenException exception) {
            return null;
        }
    }
}
