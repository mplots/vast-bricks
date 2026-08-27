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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private final PortalAuthenticationService authenticationService;
    private final PortalTokenService tokenService;

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        var user = authenticationService.authenticate(request.getEmail(), request.getPassword())
                .orElseThrow(AccountController::unauthorized);
        return new LoginResponse(tokenService.createToken(user), toProfile(user));
    }

    @GetMapping("/me")
    public UserResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw unauthorized();
        }

        try {
            var userId = tokenService.verifyAndGetUserId(authorization.substring("Bearer ".length()));
            var user = authenticationService.findActiveById(userId).orElseThrow(AccountController::unauthorized);
            return new UserResponse(toProfile(user));
        } catch (PortalTokenService.InvalidTokenException e) {
            throw unauthorized();
        }
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
