package com.vastbricks.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthenticationInterceptorTest {

    @Test
    void acceptsAValidTokenAndExposesTheAuthenticatedUser() throws Exception {
        User user = TokenServiceTest.user();
        TokenService tokenService = TokenServiceTest.tokenService();
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(tokenService, authenticationService(user));
        Map<String, Object> attributes = new HashMap<>();
        HttpServletRequest request = request("Bearer " + tokenService.createToken(user), attributes);

        assertTrue(interceptor.preHandle(request, response(new int[1]), new Object()));
        assertSame(user, attributes.get(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE));
    }

    @Test
    void rejectsRequestsWithoutABearerToken() throws Exception {
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(
                TokenServiceTest.tokenService(), authenticationService(TokenServiceTest.user()));
        int[] status = new int[1];

        assertFalse(interceptor.preHandle(request(null, new HashMap<>()), response(status), new Object()));
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, status[0]);
    }

    private AuthenticationService authenticationService(User user) {
        UserRepository repository = (UserRepository) Proxy.newProxyInstance(
                UserRepository.class.getClassLoader(),
                new Class<?>[]{UserRepository.class},
                (proxy, method, arguments) -> {
                    if ("findById".equals(method.getName())) {
                        return user.getId().equals(arguments[0]) ? Optional.of(user) : Optional.empty();
                    }
                    throw new UnsupportedOperationException(method.getName());
                });
        return new AuthenticationService(repository, new BCryptPasswordEncoder(4));
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
                });
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
                });
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
