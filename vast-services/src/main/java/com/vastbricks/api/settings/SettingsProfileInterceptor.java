package com.vastbricks.api.settings;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
class SettingsProfileInterceptor implements HandlerInterceptor {

    static final String SETTINGS_PROFILE_HEADER = "X-Vast-Settings-Profile";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        SettingsProfileContext.setProfile(request.getHeader(SETTINGS_PROFILE_HEADER));
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        SettingsProfileContext.clear();
    }
}
