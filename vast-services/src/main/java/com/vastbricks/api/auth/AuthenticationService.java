package com.vastbricks.api.auth;

import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
class AuthenticationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    Optional<User> authenticate(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()
                || email.length() > 320 || password.length() > 128) {
            return Optional.empty();
        }

        String normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(normalizedEmail).orElse(null);
        if (user == null || !user.isActive() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            return Optional.empty();
        }
        return Optional.of(user);
    }

    @Transactional(readOnly = true)
    Optional<User> findActiveById(Long id) {
        return userRepository.findById(id).filter(User::isActive);
    }
}
