package com.vastbricks.auth;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AccountController {

    private final PortalAuthenticationService authenticationService;
    private final PortalTokenService tokenService;

    @PostMapping("/account/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        var user = authenticationService.authenticate(request.getEmail(), request.getPassword())
                .orElseThrow(AccountController::unauthorized);
        return new LoginResponse(tokenService.createToken(user), toProfile(user));
    }

    @GetMapping("/private/account/me")
    public UserResponse me(
            @RequestAttribute(PortalAuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) PortalUser user) {
        return new UserResponse(toProfile(user));
    }

    private static UserProfile toProfile(PortalUser user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class LoginRequest {
        private String email;
        private String password;
    }

    @Getter
    @AllArgsConstructor
    public static class LoginResponse {
        private String serviceToken;
        private UserProfile user;
    }

    @Getter
    @AllArgsConstructor
    public static class UserResponse {
        private UserProfile user;
    }

    @Getter
    @AllArgsConstructor
    public static class UserProfile {
        private Long id;
        private String email;
        private String name;
        private String role;
    }
}
