package com.vastbricks.api.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
class AuthWebConfiguration implements WebMvcConfigurer {

    private final AuthenticationInterceptor authenticationInterceptor;
    private final PrivateApiInterceptor privateApiInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Resolution runs first and everywhere, so a request that is not private still knows its tenant. Enforcement
        // and the debug user binding both read what it left, so both sit after it.
        registry.addInterceptor(authenticationInterceptor).order(0);
        registry.addInterceptor(privateApiInterceptor).addPathPatterns("/api/private/**").order(1);
    }
}
