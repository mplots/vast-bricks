package com.vastbricks.api.auth;

import com.vastbricks.api.auth.AuthPayload.LoginRequest;
import com.vastbricks.api.auth.AuthPayload.LoginResponse;
import com.vastbricks.api.auth.AuthPayload.UserProfile;
import com.vastbricks.api.auth.AuthPayload.UserResponse;
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

    @PostMapping("/account/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        User user = authenticationService.authenticate(request.getEmail(), request.getPassword())
                .orElseThrow(AccountController::unauthorized);
        return new LoginResponse(tokenService.createToken(user), toProfile(user));
    }

    @GetMapping("/private/account/me")
    public UserResponse me(@RequestAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE) User user) {
        return new UserResponse(toProfile(user));
    }

    private static UserProfile toProfile(User user) {
        return new UserProfile(user.getId(), user.getEmail(), user.getName(), user.getRole());
    }

    private static ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }
}
