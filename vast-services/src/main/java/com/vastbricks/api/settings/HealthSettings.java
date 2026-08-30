package com.vastbricks.api.settings;

import lombok.Getter;
import org.springframework.stereotype.Component;

@Getter
@Component
class HealthSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_HEALTH_SETTING_VALUE", databaseOverride = true)
    private String value = "default-health-value";

    @VastSetting(env = "VAST_HEALTH_SETTING_ENV_VALUE", databaseOverride = true)
    private String environmentValue = "health-env-default";

    @VastSetting(env = "VAST_HEALTH_SETTING_DATABASE_ONLY_VALUE", databaseOverride = true)
    private String databaseOnlyValue = "";

    @VastSetting(env = "VAST_HEALTH_SETTING_SECRET_VALUE", databaseOverride = true, secret = true)
    private String secretValue = "";
}
