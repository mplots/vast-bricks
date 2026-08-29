package com.vastbricks.api.settings;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.MethodParameter;
import org.springframework.core.convert.ConversionException;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.TypeDescriptor;

@RequiredArgsConstructor
class SettingsOverrideMethodInterceptor implements MethodInterceptor {

    private static final Pattern VALUE_EXPRESSION = Pattern.compile("^\\$\\{([^:}]+)(?::.*)?}$");

    private final Object target;
    private final ObjectProvider<SettingsOverrideService> settingsOverrideService;
    private final ConversionService conversionService;
    private final Map<Method, Optional<SettingGetter>> getterCache = new ConcurrentHashMap<>();

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        Method method = invocation.getMethod();
        Optional<SettingGetter> settingGetter = getterCache.computeIfAbsent(method, this::findSettingGetter);
        if (settingGetter.isEmpty()) {
            return invocation.proceed();
        }

        if (SettingsProfileContext.currentProfile().isEmpty()) {
            return invocation.proceed();
        }

        Optional<String> override = settingsOverrideService.getObject().findOverride(settingGetter.get().getSettingKey());
        if (override.isEmpty()) {
            return invocation.proceed();
        }

        return convert(override.get(), settingGetter.get());
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

        Value value = field.getAnnotation(Value.class);
        if (value == null) {
            return Optional.empty();
        }

        String settingKey = settingKey(value.value());
        if (settingKey == null) {
            return Optional.empty();
        }

        return Optional.of(new SettingGetter(settingKey, TypeDescriptor.valueOf(String.class),
                new TypeDescriptor(new MethodParameter(method, -1))));
    }

    private Object convert(String value, SettingGetter settingGetter) {
        try {
            Object converted = conversionService.convert(value, settingGetter.getSourceType(), settingGetter.getReturnType());
            if (converted != null || !settingGetter.getReturnType().getType().isPrimitive()) {
                return converted;
            }
            throw new SettingsOverrideException(
                    "Database setting override for " + settingGetter.getSettingKey() + " cannot be converted to "
                            + settingGetter.getReturnType().getType().getSimpleName() + "."
            );
        } catch (ConversionException ex) {
            throw new SettingsOverrideException(
                    "Database setting override for " + settingGetter.getSettingKey() + " cannot be converted to "
                            + settingGetter.getReturnType().getResolvableType() + ".",
                    ex
            );
        }
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

    private String settingKey(String valueExpression) {
        Matcher matcher = VALUE_EXPRESSION.matcher(valueExpression);
        if (!matcher.matches()) {
            return null;
        }
        return matcher.group(1);
    }
}
