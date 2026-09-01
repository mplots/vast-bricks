package com.vastbricks.api.client.brickowl;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
class BrickOwlSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKOWL_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://api.brickowl.com";

    @VastSetting(env = "VAST_BRICKOWL_API_KEY", databaseOverride = true, secret = true)
    private String apiKey = "";
}
