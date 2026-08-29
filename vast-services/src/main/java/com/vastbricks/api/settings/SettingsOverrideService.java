package com.vastbricks.api.settings;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class SettingsOverrideService {

    private final SettingsOverrideRepository settingsOverrideRepository;
    private final SettingsOverrideSettings settings;

    Optional<String> findOverride(String settingKey) {
        Optional<String> profile = SettingsProfileContext.currentProfile();
        if (profile.isEmpty()) {
            return Optional.empty();
        }
        return settingsOverrideRepository.findValue(profile.get(), settingKey);
    }

    Optional<String> findConfiguredOverride(String settingKey) {
        Optional<String> profile = SettingsProfileContext.currentProfile();
        if (profile.isPresent()) {
            return settingsOverrideRepository.findValue(profile.get(), settingKey);
        }
        return findDefaultOverride(settingKey);
    }

    Optional<String> findDefaultOverride(String settingKey) {
        String defaultProfile = settings.getDefaultProfile();
        if (defaultProfile == null || defaultProfile.isBlank()) {
            return Optional.empty();
        }
        return settingsOverrideRepository.findValue(defaultProfile.trim(), settingKey);
    }
}
