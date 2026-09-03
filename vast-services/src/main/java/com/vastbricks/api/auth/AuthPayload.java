package com.vastbricks.api.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Every request and response body of the auth feature. Public because {@link AccountController} is. */
public final class AuthPayload {

    private AuthPayload() {
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static final class LoginRequest {
        private String email;
        private String password;
    }

    @Getter
    @AllArgsConstructor
    public static final class LoginResponse {
        private String serviceToken;
        private UserProfile user;
    }

    @Getter
    @AllArgsConstructor
    public static final class UserResponse {
        private UserProfile user;
    }

    @Getter
    @AllArgsConstructor
    public static final class UserProfile {
        private Long id;
        private String email;
        private String name;
        private String role;
    }
}
