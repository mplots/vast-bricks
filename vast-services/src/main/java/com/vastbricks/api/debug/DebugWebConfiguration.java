package com.vastbricks.api.debug;

import com.vastbricks.api.auth.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Binds the request's user to the thread for the length of the request, so provider calls made while serving it are
 * recorded under that user.
 *
 * <p>It must run after the authentication interceptor, which is what puts the user on the request. Interceptors from
 * different configurers have no order between them by default, so this one asks for a later one explicitly rather
 * than relying on which configuration Spring happened to apply first.
 */
@Configuration(proxyBeanMethods = false)
@RequiredArgsConstructor
class DebugWebConfiguration implements WebMvcConfigurer {

    private final DebugUserInterceptor debugUserInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(debugUserInterceptor).order(1);
    }

    @Component
    static class DebugUserInterceptor implements HandlerInterceptor {

        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
            DebugContext.setUserId(AuthenticatedUser.idOf(request).orElse(null));
            return true;
        }

        @Override
        public void afterCompletion(
                HttpServletRequest request,
                HttpServletResponse response,
                Object handler,
                Exception exception
        ) {
            DebugContext.clear();
        }
    }
}
