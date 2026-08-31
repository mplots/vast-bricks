package com.vastbricks.api.settings;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Getter
@Component
class SettingsOverrideSettings {

    @VastSetting(env = "VAST_SETTINGS_DEFAULT_PROFILE")
    private String defaultProfile = "default";
}
