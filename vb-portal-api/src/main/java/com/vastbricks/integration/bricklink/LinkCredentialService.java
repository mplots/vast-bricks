package com.vastbricks.integration.bricklink;

import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LinkCredentialService {

    private final LinkCredentialRepository repository;

    @Transactional
    public LinkCredential store(LinkCredentialType credentialType, String value) {
        var trimmedValue = value.trim();
        var credential = repository.findByCredentialType(credentialType)
            .orElseGet(LinkCredential::new);

        if (credential.getId() != null && Objects.equals(credential.getCredentialValue(), trimmedValue)) {
            return credential;
        }

        credential.setCredentialType(credentialType);
        credential.setCredentialValue(trimmedValue);

        return repository.save(credential);
    }

    @Transactional(readOnly = true)
    public Optional<String> findValue(LinkCredentialType credentialType) {
        return repository.findByCredentialType(credentialType)
            .map(LinkCredential::getCredentialValue)
            .map(StringUtils::trimToNull);
    }
}
