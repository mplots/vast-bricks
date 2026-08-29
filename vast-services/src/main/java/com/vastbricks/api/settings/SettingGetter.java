package com.vastbricks.api.settings;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.core.convert.TypeDescriptor;

@Getter
@RequiredArgsConstructor
class SettingGetter {

    private final String settingKey;
    private final String annotationDefaultValue;
    private final TypeDescriptor sourceType;
    private final TypeDescriptor returnType;

    boolean hasAnnotationDefaultValue() {
        return annotationDefaultValue != null && !annotationDefaultValue.isBlank();
    }
}
