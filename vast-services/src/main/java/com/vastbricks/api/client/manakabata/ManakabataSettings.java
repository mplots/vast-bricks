package com.vastbricks.api.client.manakabata;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
class ManakabataSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_MANAKABATA_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://web.manakabata.lv/api/v1";

    @VastSetting(env = "VAST_MANAKABATA_API_TOKEN", databaseOverride = true, secret = true)
    private String apiToken = "";
}
