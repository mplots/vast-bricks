package com.vastbricks.api.client.bricklink;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * The store API's address and the OAuth credentials a tenant reaches its own store with.
 *
 * <p>The base URL is a setting like every other provider's, so a mocked BrickLink is another base URL rather than
 * another flag.
 */
@Component
@Getter
class BrickLinkSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKLINK_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://api.bricklink.com/api/store/v1/";

    @VastSetting(env = "VAST_BRICKLINK_CONSUMER_KEY", databaseOverride = true, secret = true)
    private String consumerKey = "";

    @VastSetting(env = "VAST_BRICKLINK_CONSUMER_SECRET", databaseOverride = true, secret = true)
    private String consumerSecret = "";

    @VastSetting(env = "VAST_BRICKLINK_TOKEN_VALUE", databaseOverride = true, secret = true)
    private String tokenValue = "";

    @VastSetting(env = "VAST_BRICKLINK_TOKEN_SECRET", databaseOverride = true, secret = true)
    private String tokenSecret = "";
}
