package com.vastbricks.api.settings;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class SettingsOverrideService {

    private final SettingsOverrideRepository settingsOverrideRepository;
    private final SettingsOverrideSettings settings;
    private final SettingsEncryption settingsEncryption;

    Optional<String> findOverride(String settingKey) {
        Optional<String> profile = SettingsProfileContext.currentProfile();
        if (profile.isEmpty()) {
            return Optional.empty();
        }
        return settingsOverrideRepository.findByProfileAndSettingKey(profile.get(), settingKey)
                .map(SettingsOverride::getSettingValue);
    }

    Optional<String> findConfiguredOverride(String settingKey) {
        Optional<String> profile = SettingsProfileContext.currentProfile();
        if (profile.isPresent()) {
            return settingsOverrideRepository.findByProfileAndSettingKey(profile.get(), settingKey)
                    .map(SettingsOverride::getSettingValue);
        }
        return findDefaultOverride(settingKey);
    }

    Optional<String> findConfiguredOverride(String settingKey, boolean secret) {
        return findConfiguredOverride(settingKey)
                .map(value -> secret ? settingsEncryption.decrypt(value) : value);
    }

    Optional<String> findDefaultOverride(String settingKey) {
        String defaultProfile = settings.getDefaultProfile();
        if (defaultProfile == null || defaultProfile.isBlank()) {
            return Optional.empty();
        }
        return settingsOverrideRepository.findByProfileAndSettingKey(defaultProfile.trim(), settingKey)
                .map(SettingsOverride::getSettingValue);
    }
}
