package com.vastbricks.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.lang.reflect.Proxy;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import com.vastbricks.api.tenancy.TenantAccess;
import com.vastbricks.api.tenancy.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthenticationInterceptorTest {

    @AfterEach
    void clearTenant() {
        TenantContext.clear();
    }

    @Test
    void acceptsAValidTokenAndExposesTheAuthenticatedUser() throws Exception {
        User user = TokenServiceTest.user();
        TokenService tokenService = TokenServiceTest.tokenService();
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(
                tokenService, authenticationService(user), tenantAccess(true));
        Map<String, Object> attributes = new HashMap<>();
        HttpServletRequest request = request("Bearer " + tokenService.createToken(user, 7L), attributes);

        assertTrue(interceptor.preHandle(request, response(new int[1]), new Object()));
        assertSame(user, attributes.get(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE));
    }

    @Test
    void bindsTheTenantTheTokenSelected() throws Exception {
        User user = TokenServiceTest.user();
        TokenService tokenService = TokenServiceTest.tokenService();
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(
                tokenService, authenticationService(user), tenantAccess(true));
        HttpServletRequest request = request("Bearer " + tokenService.createToken(user, 7L), new HashMap<>());

        interceptor.preHandle(request, response(new int[1]), new Object());

        assertEquals(Optional.of(7L), TenantContext.currentTenantId());
    }

    @Test
    void bindsNoTenantWhenTheMembershipIsGone() throws Exception {
        User user = TokenServiceTest.user();
        TokenService tokenService = TokenServiceTest.tokenService();
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(
                tokenService, authenticationService(user), tenantAccess(false));
        Map<String, Object> attributes = new HashMap<>();
        HttpServletRequest request = request("Bearer " + tokenService.createToken(user, 7L), attributes);

        interceptor.preHandle(request, response(new int[1]), new Object());

        assertEquals(TenantContext.NO_TENANT, TenantContext.currentTenantIdOrNone());
        assertFalse(attributes.containsKey(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE));
    }

    @Test
    void rejectsRequestsWithoutABearerToken() throws Exception {
        // Resolution no longer refuses anything; the private API is what refuses an unresolved request. The two run
        // in that order for every /api/private/** call, so the behaviour asserted here is unchanged.
        AuthenticationInterceptor interceptor = new AuthenticationInterceptor(
                TokenServiceTest.tokenService(), authenticationService(TokenServiceTest.user()), tenantAccess(true));
        PrivateApiInterceptor privateApi = new PrivateApiInterceptor();
        Map<String, Object> attributes = new HashMap<>();
        HttpServletRequest request = request(null, attributes);
        int[] status = new int[1];

        interceptor.preHandle(request, response(status), new Object());

        assertFalse(privateApi.preHandle(request, response(status), new Object()));
        assertEquals(HttpServletResponse.SC_UNAUTHORIZED, status[0]);
    }

    private TenantAccess tenantAccess(boolean member) {
        return (TenantAccess) Proxy.newProxyInstance(
                TenantAccess.class.getClassLoader(),
                new Class<?>[]{TenantAccess.class},
                (proxy, method, arguments) -> switch (method.getName()) {
                    case "canServe" -> member;
                    case "tenantIdByCode" -> Optional.empty();
                    case "tenantsOf" -> java.util.List.of();
                    case "selectFor" -> Optional.empty();
                    default -> throw new UnsupportedOperationException(method.getName());
                });
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
                    if ("getAttribute".equals(method.getName())) {
                        return attributes.get((String) arguments[0]);
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
