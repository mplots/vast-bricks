package com.vastbricks.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class PortalAuthConfig {

    @Bean
    public PasswordEncoder portalPasswordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
