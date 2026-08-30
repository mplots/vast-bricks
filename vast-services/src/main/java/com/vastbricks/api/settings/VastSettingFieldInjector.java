package com.vastbricks.api.settings;

import java.lang.reflect.Field;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.convert.ApplicationConversionService;
import org.springframework.core.convert.ConversionException;
import org.springframework.core.convert.ConversionService;
import org.springframework.core.convert.TypeDescriptor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.Environment;
import org.springframework.core.env.PropertySource;
import org.springframework.util.ReflectionUtils;

@RequiredArgsConstructor
class VastSettingFieldInjector {

    private final Environment environment;
    private final ConversionService conversionService;

    VastSettingFieldInjector(Environment environment) {
        this(environment, ApplicationConversionService.getSharedInstance());
    }

    void inject(Object target) {
        ReflectionUtils.doWithFields(target.getClass(), field -> injectField(target, field));
    }

    boolean hasEnvironmentValue(String settingKey) {
        if (!(environment instanceof ConfigurableEnvironment configurableEnvironment)) {
            return hasText(environment.getProperty(settingKey));
        }

        for (PropertySource<?> propertySource : configurableEnvironment.getPropertySources()) {
            if (propertySource.containsProperty(settingKey) && hasText(propertySource.getProperty(settingKey))) {
                return true;
            }
        }
        return false;
    }

    private void injectField(Object target, Field field) {
        VastSetting setting = field.getAnnotation(VastSetting.class);
        if (setting == null) {
            return;
        }

        String value = environmentValue(setting.env());
        if (!hasText(value)) {
            return;
        }

        Object converted = convert(value, setting.env(), TypeDescriptor.valueOf(String.class), new TypeDescriptor(field));
        ReflectionUtils.makeAccessible(field);
        ReflectionUtils.setField(field, target, converted);
    }

    private String environmentValue(String settingKey) {
        if (!(environment instanceof ConfigurableEnvironment configurableEnvironment)) {
            return environment.getProperty(settingKey);
        }

        for (PropertySource<?> propertySource : configurableEnvironment.getPropertySources()) {
            if (propertySource.containsProperty(settingKey)) {
                Object value = propertySource.getProperty(settingKey);
                return value == null ? null : value.toString();
            }
        }
        return null;
    }

    Object convert(String value, String settingKey, TypeDescriptor sourceType, TypeDescriptor targetType) {
        try {
            Object converted = conversionService.convert(value, sourceType, targetType);
            if (converted != null || !targetType.getType().isPrimitive()) {
                return converted;
            }
            throw new SettingsOverrideException(
                    "Setting " + settingKey + " cannot be converted to "
                            + targetType.getType().getSimpleName() + "."
            );
        } catch (ConversionException ex) {
            throw new SettingsOverrideException(
                    "Setting " + settingKey + " cannot be converted to " + targetType.getResolvableType() + ".",
                    ex
            );
        }
    }

    private boolean hasText(Object value) {
        return value != null && !value.toString().isBlank();
    }
}
