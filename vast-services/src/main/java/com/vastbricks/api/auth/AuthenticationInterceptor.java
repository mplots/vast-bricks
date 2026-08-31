package com.vastbricks.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
class AuthenticationInterceptor implements HandlerInterceptor {

    static final String AUTHENTICATED_USER_ATTRIBUTE = "vastAuthenticatedUser";

    private final TokenService tokenService;
    private final AuthenticationService authenticationService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return unauthorized(response);
        }

        try {
            Long userId = tokenService.verifyAndGetUserId(authorization.substring("Bearer ".length()));
            User user = authenticationService.findActiveById(userId).orElse(null);
            if (user == null) {
                return unauthorized(response);
            }

            request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, user);
            return true;
        } catch (TokenService.InvalidTokenException exception) {
            return unauthorized(response);
        }
    }

    private boolean unauthorized(HttpServletResponse response) throws IOException {
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
        return false;
    }
}
