package com.vastbricks.api.auth;

import com.vastbricks.api.auth.AuthPayload.LoginRequest;
import com.vastbricks.api.auth.AuthPayload.LoginResponse;
import com.vastbricks.api.auth.AuthPayload.TenantSummary;
import com.vastbricks.api.auth.AuthPayload.UserProfile;
import com.vastbricks.api.auth.AuthPayload.UserResponse;
import com.vastbricks.api.tenancy.TenantAccess;
import com.vastbricks.api.tenancy.TenantContext;
import com.vastbricks.api.tenancy.TenantView;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AccountController {

    private final AuthenticationService authenticationService;
    private final TokenService tokenService;
    private final TenantAccess tenantAccess;

    @PostMapping("/account/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        User user = authenticationService.authenticate(request.getEmail(), request.getPassword())
                .orElseThrow(AccountController::unauthorized);

        List<TenantView> tenants = tenantAccess.tenantsOf(user.getId());
        // A login with no tenant to serve is a valid credential with nothing behind it, which is a different answer
        // from a wrong password and must not be reported as one.
        TenantView selected = tenantAccess.selectFor(user.getId(), request.getTenantCode())
                .orElseThrow(AccountController::noTenant);

        return new LoginResponse(
                tokenService.createToken(user, selected.getId()),
                toProfile(user),
                toSummary(selected),
                tenants.stream().map(AccountController::toSummary).toList()
        );
    }

    @GetMapping("/private/account/me")
    public UserResponse me(@RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user) {
        TenantSummary tenant = TenantContext.currentTenantId()
                .flatMap(tenantId -> tenantAccess.tenantsOf(user.getId()).stream()
                        .filter(candidate -> candidate.getId().equals(tenantId))
                        .findFirst())
                .map(AccountController::toSummary)
                .orElse(null);
        return new UserResponse(toProfile(user), tenant);
    }

    private static TenantSummary toSummary(TenantView tenant) {
        return new TenantSummary(tenant.getId(), tenant.getCode(), tenant.getName());
    }

    private static UserProfile toProfile(User user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    private static ResponseStatusException noTenant() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "No tenant available for this account");
    }
}
