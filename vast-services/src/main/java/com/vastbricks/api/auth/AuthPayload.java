package com.vastbricks.api.auth;

import java.util.List;
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
        /** Which of the caller's tenants to serve. Absent selects their first, which is the only one for most. */
        private String tenantCode;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static final class SwitchTenantRequest {
        private String tenantCode;
    }

    @Getter
    @AllArgsConstructor
    public static final class LoginResponse {
        private String serviceToken;
        private UserProfile user;
        /** The tenant this token serves. Every request it authenticates reads and writes that tenant's data. */
        private TenantSummary tenant;
        /** Every tenant the caller may serve, so the portal can offer a switch without asking again. */
        private List<TenantSummary> tenants;
    }

    @Getter
    @AllArgsConstructor
    public static final class UserResponse {
        private UserProfile user;
        private TenantSummary tenant;
        /** Every tenant the caller may serve, so a session resumed from a stored token can still offer a switch. */
        private List<TenantSummary> tenants;
    }

    @Getter
    @AllArgsConstructor
    public static final class TenantSummary {
        private Long id;
        private String code;
        private String name;
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
