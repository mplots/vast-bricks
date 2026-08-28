package com.vastbricks.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class PortalAuthenticationInterceptor implements HandlerInterceptor {

    public static final String AUTHENTICATED_USER_ATTRIBUTE = "portalAuthenticatedUser";

    private final PortalTokenService tokenService;
    private final PortalAuthenticationService authenticationService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        var authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return unauthorized(response);
        }

        try {
            var userId = tokenService.verifyAndGetUserId(authorization.substring("Bearer ".length()));
            var user = authenticationService.findActiveById(userId).orElse(null);
            if (user == null) {
                return unauthorized(response);
            }

            request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, user);
            return true;
        } catch (PortalTokenService.InvalidTokenException e) {
            return unauthorized(response);
        }
    }

    private boolean unauthorized(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
        return false;
    }
}
