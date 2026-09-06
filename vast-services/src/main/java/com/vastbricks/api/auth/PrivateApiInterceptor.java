package com.vastbricks.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Refuses a private-API request that {@link AuthenticationInterceptor} could not resolve a user and tenant for.
 *
 * <p>A token whose tenant the user may no longer serve fails here exactly as an expired one does: membership is what
 * the request is authorized against, not what the token asserts.
 */
@Component
class PrivateApiInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (request.getAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) == null) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
            return false;
        }
        return true;
    }
}
