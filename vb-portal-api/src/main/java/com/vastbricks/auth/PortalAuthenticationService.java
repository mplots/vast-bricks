package com.vastbricks.auth;

import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PortalAuthenticationService {

    private final PortalUserRepository portalUserRepository;
    private final PasswordEncoder portalPasswordEncoder;

    @Transactional(readOnly = true)
    public Optional<PortalUser> authenticate(String email, String password) {
        if (StringUtils.isBlank(email) || StringUtils.isBlank(password) || email.length() > 320 || password.length() > 128) {
            return Optional.empty();
        }

        var normalizedEmail = email.trim().toLowerCase(Locale.ROOT);
        var user = portalUserRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);

        if (user == null || !user.isActive() || !portalPasswordEncoder.matches(password, user.getPasswordHash())) {
            return Optional.empty();
        }

        return Optional.of(user);
    }

    @Transactional(readOnly = true)
    public Optional<PortalUser> findActiveById(Long id) {
        return portalUserRepository.findById(id).filter(PortalUser::isActive);
    }
}
