package com.vastbricks.api.client.paypal;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
class PayPalSettings extends DatabaseBackedSettings {

    /** Live PayPal. The sandbox is another base URL ({@code https://api-m.sandbox.paypal.com}), not another flag. */
    @VastSetting(env = "VAST_PAYPAL_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://api-m.paypal.com";

    @VastSetting(env = "VAST_PAYPAL_CLIENT_ID", databaseOverride = true, secret = true)
    private String clientId = "";

    @VastSetting(env = "VAST_PAYPAL_CLIENT_SECRET", databaseOverride = true, secret = true)
    private String clientSecret = "";
}
