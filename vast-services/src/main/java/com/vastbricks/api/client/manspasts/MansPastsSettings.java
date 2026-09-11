package com.vastbricks.api.client.manspasts;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * What the Mans Pasts self-service account is reached as.
 *
 * <p>Mans Pasts publishes no API for the shipment register a store sees when it signs in, so this half of the
 * provider is the account's own username and password rather than a key. They are secrets like any other credential
 * and are settings-backed like every other provider's, so a tenant reaches its own account.
 */
@Component
@Getter
class MansPastsSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_MANSPASTS_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://www.manspasts.lv";

    @VastSetting(env = "VAST_MANSPASTS_USERNAME", databaseOverride = true, secret = true)
    private String username = "";

    @VastSetting(env = "VAST_MANSPASTS_PASSWORD", databaseOverride = true, secret = true)
    private String password = "";
}
