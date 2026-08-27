package com.vastbricks.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PortalTokenServiceTest {

    @Test
    void createsAndVerifiesSignedTokens() throws ReflectiveOperationException {
        var service = tokenService();
        var token = service.createToken(user());

        assertEquals(42L, service.verifyAndGetUserId(token));
    }

    @Test
    void rejectsTamperedTokens() throws ReflectiveOperationException {
        var service = tokenService();
        var token = service.createToken(user());
        var tamperedToken = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        assertThrows(PortalTokenService.InvalidTokenException.class, () -> service.verifyAndGetUserId(tamperedToken));
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
}
