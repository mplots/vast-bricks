package com.vastbricks.api.setup.settings;

import com.vastbricks.api.setup.SetupEncryption;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class SettingsOverrideService {

    private final SettingsOverrideRepository settingsOverrideRepository;
    private final SetupEncryption settingsEncryption;

    Optional<String> findConfiguredOverride(String settingKey) {
        return settingsOverrideRepository.findBySettingKey(settingKey).map(SettingsOverride::getSettingValue);
    }

    Optional<String> findConfiguredOverride(String settingKey, boolean secret) {
        return findConfiguredOverride(settingKey)
                .map(value -> secret ? settingsEncryption.decrypt(value) : value);
    }
}
