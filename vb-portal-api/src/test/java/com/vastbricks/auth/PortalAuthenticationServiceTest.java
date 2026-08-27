package com.vastbricks.auth;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.lang.reflect.Proxy;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PortalAuthenticationServiceTest {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Test
    void authenticatesAnActiveUserWithTheCorrectPassword() {
        var user = user("user@example.com", "correct-password", true);
        var service = new PortalAuthenticationService(repository(user), passwordEncoder);

        assertTrue(service.authenticate(" USER@example.com ", "correct-password").isPresent());
    }

    @Test
    void rejectsWrongPasswordUnknownEmailAndInactiveUser() {
        var activeUser = user("user@example.com", "correct-password", true);
        var activeUserService = new PortalAuthenticationService(repository(activeUser), passwordEncoder);
        assertTrue(activeUserService.authenticate("user@example.com", "wrong-password").isEmpty());
        assertTrue(activeUserService.authenticate("missing@example.com", "wrong-password").isEmpty());

        var inactiveUser = user("disabled@example.com", "correct-password", false);
        var inactiveUserService = new PortalAuthenticationService(repository(inactiveUser), passwordEncoder);
        assertTrue(inactiveUserService.authenticate("disabled@example.com", "correct-password").isEmpty());
    }

    private PortalUser user(String email, String password, boolean active) {
        var user = new PortalUser();
        user.setId(1L);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setName("Test User");
        user.setRole("admin");
        user.setActive(active);
        return user;
    }

    private PortalUserRepository repository(PortalUser user) {
        return (PortalUserRepository) Proxy.newProxyInstance(
                PortalUserRepository.class.getClassLoader(),
                new Class<?>[]{PortalUserRepository.class},
                (proxy, method, arguments) -> {
                    if ("findByEmailIgnoreCase".equals(method.getName())) {
                        var email = (String) arguments[0];
                        return user.getEmail().equalsIgnoreCase(email) ? Optional.of(user) : Optional.empty();
                    }
                    if ("findById".equals(method.getName())) {
                        return user.getId().equals(arguments[0]) ? Optional.of(user) : Optional.empty();
                    }
                    throw new UnsupportedOperationException(method.getName());
                }
        );
    }
}
