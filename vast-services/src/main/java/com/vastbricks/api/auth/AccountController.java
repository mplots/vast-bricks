package com.vastbricks.api.auth;

import com.vastbricks.api.auth.AuthPayload.LoginRequest;
import com.vastbricks.api.auth.AuthPayload.LoginResponse;
import com.vastbricks.api.auth.AuthPayload.SwitchTenantRequest;
import com.vastbricks.api.auth.AuthPayload.TenantSummary;
import com.vastbricks.api.auth.AuthPayload.UserProfile;
import com.vastbricks.api.auth.AuthPayload.UserResponse;
import com.vastbricks.api.tenancy.TenantAccess;
import com.vastbricks.api.tenancy.TenantContext;
import com.vastbricks.api.tenancy.TenantView;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.authentication.www.BasicAuthenticationConverter;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class AccountController {

    private final AuthenticationService authenticationService;
    private final TokenService tokenService;
    private final TenantAccess tenantAccess;
    private final ObjectMapper objectMapper;

    private static final String BASIC_REALM = "WWW-Authenticate";
    private static final String BASIC_CHALLENGE = "Basic realm=\"vast-bricks\", charset=\"UTF-8\"";
    private static final BasicAuthenticationConverter BASIC_AUTH = new BasicAuthenticationConverter();

    /**
     * An alternate front door for {@link #login}: same credential check, same token, just carried by the
     * {@code Authorization: Basic} header instead of a JSON body. Visiting this URL directly with no
     * credentials (or embedding {@code user:pass@} in it) makes the browser handle the prompt natively and,
     * on success, land the caller in the portal already signed in.
     *
     * <p>The token cannot be written into localStorage from a redirect response alone, so this returns a tiny
     * HTML page whose only job is to store it and hand off to the SPA at {@code /}, exactly where a normal
     * login already leaves the user.
     */
    @GetMapping(value = "/account/basic-login", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> basicLogin(
            HttpServletRequest request,
            @RequestParam(value = "tenantCode", required = false) String tenantCode) {
        UsernamePasswordAuthenticationToken credentials;
        try {
            credentials = BASIC_AUTH.convert(request);
        } catch (BadCredentialsException exception) {
            return challengeResponse();
        }
        if (credentials == null) {
            return challengeResponse();
        }

        Optional<User> authenticated =
                authenticationService.authenticate((String) credentials.getPrincipal(), (String) credentials.getCredentials());
        if (authenticated.isEmpty()) {
            return challengeResponse();
        }
        User user = authenticated.get();

        Optional<TenantView> selected = tenantAccess.selectFor(user.getId(), tenantCode);
        if (selected.isEmpty()) {
            var problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "No tenant available for this account");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(problem.getDetail());
        }

        String token = tokenService.createToken(user, selected.get().getId());
        return ResponseEntity.ok(landingPage(token));
    }

    private static ResponseEntity<String> challengeResponse() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(BASIC_REALM, BASIC_CHALLENGE)
                .body("Invalid email or password");
    }

    private String landingPage(String token) {
        String tokenLiteral = writeJsonString(token);
        return """
                <!doctype html>
                <meta charset="utf-8">
                <title>Signing in…</title>
                <script>
                  localStorage.setItem('serviceToken', %s);
                  location.replace('/');
                </script>
                """.formatted(tokenLiteral);
    }

    private String writeJsonString(String value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Failed to render basic-login landing page", exception);
        }
    }

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
        List<TenantView> tenants = tenantAccess.tenantsOf(user.getId());
        TenantSummary tenant = TenantContext.currentTenantId()
                .flatMap(tenantId -> tenants.stream()
                        .filter(candidate -> candidate.getId().equals(tenantId))
                        .findFirst())
                .map(AccountController::toSummary)
                .orElse(null);
        return new UserResponse(toProfile(user), tenant, tenants.stream().map(AccountController::toSummary).toList());
    }

    /**
     * Moves the caller's token to another of their tenants without asking for the password again: the credential
     * already proved who they are, and which tenant it serves is a choice on top of that, not a second identity.
     */
    @PostMapping("/private/account/switch-tenant")
    public LoginResponse switchTenant(
            @RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user,
            @RequestBody SwitchTenantRequest request) {
        List<TenantView> tenants = tenantAccess.tenantsOf(user.getId());
        TenantView selected = tenantAccess.selectFor(user.getId(), request.getTenantCode())
                .orElseThrow(AccountController::noTenant);

        return new LoginResponse(
                tokenService.createToken(user, selected.getId()),
                toProfile(user),
                toSummary(selected),
                tenants.stream().map(AccountController::toSummary).toList()
        );
    }

    private static TenantSummary toSummary(TenantView tenant) {
        return new TenantSummary(tenant.getId(), tenant.getCode(), tenant.getName());
    }

    private static UserProfile toProfile(User user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    private static InvalidCredentialsException unauthorized() {
        return new InvalidCredentialsException("Invalid email or password");
    }

    private static NoTenantAvailableException noTenant() {
        return new NoTenantAvailableException("No tenant available for this account");
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ProblemDetail handleInvalidCredentials(InvalidCredentialsException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, exception.getMessage());
        problem.setTitle("Invalid credentials");
        return problem;
    }

    @ExceptionHandler(NoTenantAvailableException.class)
    ProblemDetail handleNoTenant(NoTenantAvailableException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, exception.getMessage());
        problem.setTitle("No tenant available");
        return problem;
    }
}
