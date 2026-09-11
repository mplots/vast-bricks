package com.vastbricks.api.auth;

import com.vastbricks.api.tenancy.TenantProvisioning;
import com.vastbricks.api.tenancy.TenantView;
import java.util.Locale;
import java.util.Map;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Registers a tenant, a user who may serve it, and a token for that pairing, in one call.
 *
 * <p>A scenario's tenant is what isolates it from every other scenario, so setting one up is setup, not subject
 * matter: this exists so a test does not reach into the database to do it. It lives in the auth package because the
 * user and the token service it needs are package-private there, and calls the tenancy feature's public
 * provisioning API for the rest.
 */
@RestController
@RequestMapping(path = "/api/test/tenants", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastTenantRegistrationTestController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final TenantProvisioning tenantProvisioning;

    @PostMapping
    Map<String, Object> register(@RequestBody RegistrationRequest request) {
        TenantView tenant = tenantProvisioning.create(request.getTenantCode(), request.getTenantName());

        User user = new User();
        user.setEmail(request.getEmail().trim().toLowerCase(Locale.ROOT));
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName() == null ? "Acceptance User" : request.getName());
        user.setRole(request.getRole() == null ? "user" : request.getRole());
        user.setActive(true);
        User created = userRepository.save(user);

        tenantProvisioning.addMember(created.getId(), tenant.getId());

        return Map.of(
                "tenant", Map.of("id", tenant.getId(), "code", tenant.getCode(), "name", tenant.getName()),
                "user", Map.of(
                        "id", created.getId(),
                        "email", created.getEmail(),
                        "name", created.getName(),
                        "role", created.getRole()
                ),
                "serviceToken", tokenService.createToken(created, tenant.getId())
        );
    }

    /** A second (or third...) tenant for an already-registered user, to set up a switch-tenant scenario. */
    @PostMapping("/{userId}/memberships")
    Map<String, Object> addMembership(@PathVariable("userId") Long userId, @RequestBody AdditionalTenantRequest request) {
        TenantView tenant = tenantProvisioning.create(request.getTenantCode(), request.getTenantName());
        tenantProvisioning.addMember(userId, tenant.getId());
        return Map.of("tenant", Map.of("id", tenant.getId(), "code", tenant.getCode(), "name", tenant.getName()));
    }

    @Getter
    @Setter
    @NoArgsConstructor
    static class RegistrationRequest {
        private String tenantCode;
        private String tenantName;
        private String email;
        private String password;
        private String name;
        private String role;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    static class AdditionalTenantRequest {
        private String tenantCode;
        private String tenantName;
    }
}
