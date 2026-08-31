package com.vastbricks.api.auth;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Getter
@Component
class AuthSettings {

    // JWT signing is bootstrap security configuration, not a mutable
    // database-backed @VastSetting override.
    @Value("${VAST_AUTH_JWT_SECRET:}")
    private String jwtSecret = "";
}
