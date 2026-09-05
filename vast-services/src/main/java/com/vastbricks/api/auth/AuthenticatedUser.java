package com.vastbricks.api.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;

/**
 * Who the authentication interceptor resolved for the request being served.
 *
 * <p>The user itself and the attribute it is stashed under stay package-private; a feature outside this package that
 * only needs to know whose request it is asks here rather than reaching for either.
 */
public final class AuthenticatedUser {

    private AuthenticatedUser() {
    }

    /** The authenticated user's id, or empty on a request that was never authenticated. */
    public static Optional<Long> idOf(HttpServletRequest request) {
        return Optional.ofNullable(request.getAttribute(AuthenticationInterceptor.AUTHENTICATED_USER_ATTRIBUTE))
                .filter(User.class::isInstance)
                .map(User.class::cast)
                .map(User::getId);
    }
}
