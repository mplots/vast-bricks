package com.vastbricks.api.settings;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
class SettingsWebConfiguration implements WebMvcConfigurer {

    private final SettingsProfileInterceptor settingsProfileInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(settingsProfileInterceptor);
    }
}
