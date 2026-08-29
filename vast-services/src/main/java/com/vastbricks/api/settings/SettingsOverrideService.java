package com.vastbricks.api.settings;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class SettingsOverrideService {

    private final SettingsOverrideRepository settingsOverrideRepository;

    Optional<String> findOverride(String settingKey) {
        Optional<String> profile = SettingsProfileContext.currentProfile();
        if (profile.isEmpty()) {
            return Optional.empty();
        }
        return settingsOverrideRepository.findValue(profile.get(), settingKey);
    }
}
