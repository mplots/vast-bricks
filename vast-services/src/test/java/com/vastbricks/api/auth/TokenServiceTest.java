package com.vastbricks.api.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.lang.reflect.Field;
import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TokenServiceTest {

    @Test
    void createsAndVerifiesSignedTokens() throws ReflectiveOperationException {
        TokenService service = tokenService();
        String token = service.createToken(user());

        assertEquals(42L, service.verifyAndGetUserId(token));
    }

    @Test
    void rejectsTamperedTokens() throws ReflectiveOperationException {
        TokenService service = tokenService();
        String token = service.createToken(user());
        String tamperedToken = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        assertThrows(TokenService.InvalidTokenException.class, () -> service.verifyAndGetUserId(tamperedToken));
    }

    static TokenService tokenService() throws ReflectiveOperationException {
        AuthSettings settings = new AuthSettings();
        Field secretField = AuthSettings.class.getDeclaredField("jwtSecret");
        secretField.setAccessible(true);
        secretField.set(settings, "test-secret-that-is-at-least-thirty-two-bytes");
        return new TokenService(new ObjectMapper(), settings);
    }

    static User user() {
        return new User(42L, "user@example.com", "", "Test User", "admin", true, Instant.EPOCH);
    }
}
