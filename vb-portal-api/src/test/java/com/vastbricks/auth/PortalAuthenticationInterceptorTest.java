package com.vastbricks.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PortalAuthenticationInterceptorTest {

    @Test
    void acceptsAValidTokenAndExposesTheAuthenticatedUser() throws Exception {
        var user = user();
        var tokenService = tokenService();
        var interceptor = new PortalAuthenticationInterceptor(tokenService, authenticationService(user));
        var attributes = new HashMap<String, Object>();
        var request = request("Bearer " + tokenService.createToken(user), attributes);

        assertTrue(interceptor.preHandle(request, response(new int[1]), new Object()));
        assertSame(user, attributes.get(PortalAuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE));
    }

    @Test
    void rejectsRequestsWithoutABearerToken() throws Exception {
        var interceptor = new PortalAuthenticationInterceptor(tokenService(), authenticationService(user()));
        var status = new int[1];

        assertFalse(interceptor.preHandle(request(null, new HashMap<>()), response(status), new Object()));
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, status[0]);
    }

    private PortalAuthenticationService authenticationService(PortalUser user) {
        var repository = (PortalUserRepository) Proxy.newProxyInstance(
                PortalUserRepository.class.getClassLoader(),
                new Class<?>[]{PortalUserRepository.class},
                (proxy, method, arguments) -> {
                    if ("findById".equals(method.getName()) && user.getId().equals(arguments[0])) {
                        return Optional.of(user);
                    }
                    if ("findById".equals(method.getName()) || "findByEmailIgnoreCase".equals(method.getName())) {
                        return Optional.empty();
                    }
                    throw new UnsupportedOperationException(method.getName());
                }
        );
        return new PortalAuthenticationService(repository, new BCryptPasswordEncoder(4));
    }

    private PortalTokenService tokenService() throws ReflectiveOperationException {
        var env = new Env();
        Field secretField = Env.class.getDeclaredField("portalJwtSecret");
        secretField.setAccessible(true);
        secretField.set(env, "test-secret-that-is-at-least-thirty-two-bytes");
        return new PortalTokenService(new ObjectMapper(), env);
    }

    private PortalUser user() {
        var user = new PortalUser();
        user.setId(42L);
        user.setEmail("user@example.com");
        user.setName("Test User");
        user.setRole("admin");
        user.setActive(true);
        return user;
    }

    private HttpServletRequest request(String authorization, Map<String, Object> attributes) {
        return (HttpServletRequest) Proxy.newProxyInstance(
                HttpServletRequest.class.getClassLoader(),
                new Class<?>[]{HttpServletRequest.class},
                (proxy, method, arguments) -> {
                    if ("getHeader".equals(method.getName()) && HttpHeaders.AUTHORIZATION.equals(arguments[0])) {
                        return authorization;
                    }
                    if ("setAttribute".equals(method.getName())) {
                        attributes.put((String) arguments[0], arguments[1]);
                        return null;
                    }
                    return defaultValue(method.getReturnType());
                }
        );
    }

    private HttpServletResponse response(int[] status) {
        return (HttpServletResponse) Proxy.newProxyInstance(
                HttpServletResponse.class.getClassLoader(),
                new Class<?>[]{HttpServletResponse.class},
                (proxy, method, arguments) -> {
                    if ("sendError".equals(method.getName())) {
                        status[0] = (Integer) arguments[0];
                        return null;
                    }
                    return defaultValue(method.getReturnType());
                }
        );
    }

    private Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) {
            return null;
        }
        if (type == boolean.class) {
            return false;
        }
        if (type == char.class) {
            return '\0';
        }
        return 0;
    }
}
