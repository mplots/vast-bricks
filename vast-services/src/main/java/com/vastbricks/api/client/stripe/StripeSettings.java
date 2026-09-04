package com.vastbricks.api.client.stripe;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

@Component
@Getter
class StripeSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_STRIPE_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://api.stripe.com";

    @VastSetting(env = "VAST_STRIPE_SECRET_KEY", databaseOverride = true, secret = true)
    private String secretKey = "";
}
