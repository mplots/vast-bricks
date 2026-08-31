package com.vastbricks.api.auth;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
class User {

    private final Long id;
    private final String email;
    private final String passwordHash;
    private final String name;
    private final String role;
    private final boolean active;
    private final Instant createdAt;
}
