package com.vastbricks.integration.bricklink;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LinkCredentialRepository extends JpaRepository<LinkCredential, Long> {
    Optional<LinkCredential> findByCredentialType(LinkCredentialType credentialType);
}
