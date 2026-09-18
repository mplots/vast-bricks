package com.vastbricks.api.client.ecb;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Where the European Central Bank's reference rates are reached.
 *
 * <p>No credential, like {@code LatvijasPastsSettings}: the feed is public and answers anonymously. Still a
 * database-backed setting so an acceptance scenario can point one tenant's sync at WireMock without taking the
 * provider away from the tenants beside it.
 */
@Component
@Getter
public class EcbSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_ECB_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://www.ecb.europa.eu";
}
