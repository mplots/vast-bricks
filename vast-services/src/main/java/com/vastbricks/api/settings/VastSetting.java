package com.vastbricks.api.settings;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface VastSetting {

    String env();

    boolean databaseOverride() default false;

    boolean secret() default false;
}
