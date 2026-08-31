package com.vastbricks.api.auth;

import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthenticationServiceTest {

    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    @Test
    void authenticatesAnActiveUserWithTheCorrectPassword() {
        User user = user("user@example.com", "correct-password", true);
        AuthenticationService service = new AuthenticationService(repository(user), passwordEncoder);

        assertTrue(service.authenticate(" USER@example.com ", "correct-password").isPresent());
    }

    @Test
    void rejectsWrongPasswordUnknownEmailAndInactiveUser() {
        User activeUser = user("user@example.com", "correct-password", true);
        AuthenticationService activeUserService = new AuthenticationService(repository(activeUser), passwordEncoder);
        assertTrue(activeUserService.authenticate("user@example.com", "wrong-password").isEmpty());
        assertTrue(activeUserService.authenticate("missing@example.com", "wrong-password").isEmpty());

        User inactiveUser = user("disabled@example.com", "correct-password", false);
        AuthenticationService inactiveUserService = new AuthenticationService(repository(inactiveUser), passwordEncoder);
        assertTrue(inactiveUserService.authenticate("disabled@example.com", "correct-password").isEmpty());
    }

    private User user(String email, String password, boolean active) {
        return new User(1L, email, passwordEncoder.encode(password), "Test User", "admin", active, Instant.EPOCH);
    }

    private UserRepository repository(User user) {
        return new UserRepository(null) {
            @Override
            Optional<User> findByEmail(String email) {
                return user.getEmail().equalsIgnoreCase(email) ? Optional.of(user) : Optional.empty();
            }

            @Override
            Optional<User> findById(Long id) {
                return user.getId().equals(id) ? Optional.of(user) : Optional.empty();
            }
        };
    }
}
