package com.vastbricks.api.client.brickstore;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
class BrickStoreSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKSTORE_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://www.bricklink.com";

    @VastSetting(env = "VAST_BRICKSTORE_SESSION_BASE_URL", databaseOverride = true)
    private String sessionBaseUrl = "https://account.prod.member.bricklink.info";

    @VastSetting(env = "VAST_BRICKSTORE_TOKEN", databaseOverride = true, secret = true)
    private String token = "";

    @VastSetting(env = "VAST_BRICKSTORE_TOR_ENABLED", databaseOverride = true)
    private boolean torEnabled = true;
}
