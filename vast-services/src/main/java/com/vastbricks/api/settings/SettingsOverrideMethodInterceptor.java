package com.vastbricks.api.settings;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.MethodParameter;
import org.springframework.core.convert.TypeDescriptor;

@RequiredArgsConstructor
class SettingsOverrideMethodInterceptor implements MethodInterceptor {

    private final Object target;
    private final ObjectProvider<SettingsOverrideService> settingsOverrideService;
    private final VastSettingFieldInjector settingFieldInjector;
    private final Map<Method, Optional<SettingGetter>> getterCache = new ConcurrentHashMap<>();

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Method method = invocation.getMethod();
        Optional<SettingGetter> settingGetter = getterCache.computeIfAbsent(method, this::findSettingGetter);
        if (settingGetter.isEmpty()) {
            return invocation.proceed();
        }

        SettingGetter getter = settingGetter.get();
        if (settingFieldInjector.hasEnvironmentValue(getter.getSettingKey())) {
            return invocation.proceed();
        }

        Optional<String> override = settingsOverrideService.getObject()
                .findConfiguredOverride(getter.getSettingKey(), getter.isSecret());
        if (override.isEmpty()) {
            return invocation.proceed();
        }

        return convert(override.get(), getter);
    }

    private Optional<SettingGetter> findSettingGetter(Method method) {
        if (method.getParameterCount() != 0 || method.getReturnType().equals(Void.TYPE)) {
            return Optional.empty();
        }

        String fieldName = getterFieldName(method);
        if (fieldName == null) {
            return Optional.empty();
        }

        Field field = findField(target.getClass(), fieldName);
        if (field == null) {
            return Optional.empty();
        }

        VastSetting setting = field.getAnnotation(VastSetting.class);
        if (setting == null || !setting.databaseOverride()) {
            return Optional.empty();
        }

        return Optional.of(new SettingGetter(setting.env(),
                setting.secret(),
                TypeDescriptor.valueOf(String.class),
                new TypeDescriptor(new MethodParameter(method, -1))));
    }

    private Object convert(String value, SettingGetter settingGetter) {
        return settingFieldInjector.convert(value, settingGetter.getSettingKey(),
                settingGetter.getSourceType(), settingGetter.getReturnType());
    }

    private String getterFieldName(Method method) {
        String methodName = method.getName();
        if (methodName.startsWith("get") && methodName.length() > 3) {
            return decapitalize(methodName.substring(3));
        }
        if (methodName.startsWith("is") && methodName.length() > 2
                && (method.getReturnType().equals(Boolean.TYPE) || method.getReturnType().equals(Boolean.class))) {
            return decapitalize(methodName.substring(2));
        }
        return null;
    }

    private String decapitalize(String value) {
        if (value.length() > 1 && Character.isUpperCase(value.charAt(0)) && Character.isUpperCase(value.charAt(1))) {
            return value;
        }
        return Character.toLowerCase(value.charAt(0)) + value.substring(1);
    }

    private Field findField(Class<?> type, String fieldName) {
        Class<?> current = type;
        while (current != null && !current.equals(Object.class)) {
            try {
                return current.getDeclaredField(fieldName);
            } catch (NoSuchFieldException ignored) {
                current = current.getSuperclass();
            }
        }
        return null;
    }

}
