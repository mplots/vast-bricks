package com.vastbricks.api.settings;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VastSettingsWriter {

    private final SettingsOverrideRepository settingsOverrideRepository;
    private final SettingsOverrideSettings settings;
    private final SettingsEncryption settingsEncryption;

    @Transactional
    public void storeSecret(String settingKey, String settingValue) {
        storeValue(resolveProfile(), settingKey, settingsEncryption.encrypt(settingValue));
    }

    @Transactional
    public void storeDefaultSecret(String settingKey, String settingValue) {
        storeValue(resolveDefaultProfile(), settingKey, settingsEncryption.encrypt(settingValue));
    }

    private String resolveProfile() {
        return SettingsProfileContext.currentProfile().orElseGet(this::resolveDefaultProfile);
    }

    private String resolveDefaultProfile() {
        String defaultProfile = settings.getDefaultProfile();
        if (defaultProfile == null || defaultProfile.isBlank()) {
            throw new SettingsOverrideException("Default settings profile is required to write setting overrides.");
        }
        return defaultProfile.trim();
    }

    private void storeValue(String profile, String settingKey, String settingValue) {
        SettingsOverride override = settingsOverrideRepository.findByProfileAndSettingKey(profile, settingKey)
                .orElseGet(() -> new SettingsOverride(profile, settingKey, settingValue));
        override.setSettingValue(settingValue);
        settingsOverrideRepository.save(override);
    }
}
