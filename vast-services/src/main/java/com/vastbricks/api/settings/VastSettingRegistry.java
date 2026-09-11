package com.vastbricks.api.settings;

import com.vastbricks.api.settings.SettingsPayload.VastSettingView;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.util.ReflectionUtils;

/**
 * Every {@code @VastSetting(databaseOverride = true)} field across every {@link DatabaseBackedSettings} bean, so one
 * screen can list and edit all of them without a new controller for each settings class that comes along.
 */
@Component
class VastSettingRegistry {

    private final SettingsOverrideService settingsOverrideService;
    private final List<Entry> entries;
    private final VastSettingFieldInjector fieldInjector;

    VastSettingRegistry(
            List<DatabaseBackedSettings> settingsBeans, Environment environment, SettingsOverrideService settingsOverrideService) {
        this.settingsOverrideService = settingsOverrideService;
        this.fieldInjector = new VastSettingFieldInjector(environment);

        List<Entry> discovered = new ArrayList<>();
        for (DatabaseBackedSettings bean : settingsBeans) {
            ReflectionUtils.doWithFields(bean.getClass(), field -> onField(bean, field, discovered));
        }
        this.entries = List.copyOf(discovered);
    }

    List<VastSettingView> describe() {
        return entries.stream().map(this::toView).toList();
    }

    boolean isKnown(String settingKey) {
        return find(settingKey).isPresent();
    }

    boolean isSecret(String settingKey) {
        return find(settingKey).map(Entry::secret).orElse(false);
    }

    private Optional<Entry> find(String settingKey) {
        return entries.stream().filter(entry -> entry.settingKey().equals(settingKey)).findFirst();
    }

    private void onField(DatabaseBackedSettings bean, Field field, List<Entry> discovered) {
        VastSetting setting = field.getAnnotation(VastSetting.class);
        if (setting == null || !setting.databaseOverride()) {
            return;
        }

        Method getter = findGetter(field);
        if (getter == null) {
            return;
        }

        discovered.add(new Entry(
                bean, getter, setting.env(), setting.secret(), field.getDeclaringClass().getSimpleName(), field.getName()));
    }

    private Method findGetter(Field field) {
        String capitalized = Character.toUpperCase(field.getName().charAt(0)) + field.getName().substring(1);
        Method getter = ReflectionUtils.findMethod(field.getDeclaringClass(), "get" + capitalized);
        if (getter == null) {
            getter = ReflectionUtils.findMethod(field.getDeclaringClass(), "is" + capitalized);
        }
        if (getter != null) {
            // The settings class itself is usually package-private, so a public getter still needs this from here.
            ReflectionUtils.makeAccessible(getter);
        }
        return getter;
    }

    private VastSettingView toView(Entry entry) {
        boolean configured = settingsOverrideService.findConfiguredOverride(entry.settingKey()).isPresent();
        String rawValue = currentValue(entry, configured);
        return new VastSettingView(
                entry.settingKey(), entry.group(), label(entry.fieldName()), entry.secret(), configured, entry.secret() ? null : rawValue);
    }

    /**
     * The setting's value as the raw text it was configured with, never as the type-converted object a settings
     * class's getter returns. A setting overridden in the database is written back exactly as typed here, and an
     * env-backed setting is read back exactly as the environment states it - a round trip through, say, a
     * {@code Set<Integer>}'s own {@code toString()} would not be the text either side of that round trip accepts.
     *
     * <p>Mirrors {@link SettingsOverrideMethodInterceptor}'s precedence: a tenant's own override wins over the
     * environment, which is what makes it an override rather than a suggestion.
     */
    private String currentValue(Entry entry, boolean configured) {
        if (configured) {
            return settingsOverrideService.findConfiguredOverride(entry.settingKey(), entry.secret()).orElse(null);
        }

        String environmentValue = fieldInjector.environmentValue(entry.settingKey());
        if (environmentValue != null && !environmentValue.isBlank()) {
            return environmentValue;
        }

        // Nothing configured anywhere: fall back to the settings class's own compile-time default.
        try {
            Object result = entry.getter().invoke(entry.bean());
            return result == null ? null : result.toString();
        } catch (IllegalAccessException | InvocationTargetException ex) {
            throw new SettingsOverrideException("Failed to read setting " + entry.settingKey() + ".", ex);
        }
    }

    private String label(String fieldName) {
        String withSpaces = fieldName.replaceAll("([a-z])([A-Z])", "$1 $2");
        return Character.toUpperCase(withSpaces.charAt(0)) + withSpaces.substring(1);
    }

    private record Entry(
            DatabaseBackedSettings bean, Method getter, String settingKey, boolean secret, String group, String fieldName) {
    }
}
