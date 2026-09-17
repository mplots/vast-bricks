package com.vastbricks.api.client.latvijaspasts;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Where the tariff calculator is reached, and how gently.
 *
 * <p>No credential, alone among the providers: the calculator behind {@code mans.pasts.lv} answers anonymously,
 * which is also why the prices it states are the public self-service ones rather than an account's contract
 * pricing. The base URL is still a database-backed setting so an acceptance scenario can point one tenant's sweep
 * at WireMock without taking the provider away from the tenants beside it.
 *
 * <p>This is a different host from {@code www.manspasts.lv}, which
 * {@code com.vastbricks.api.client.manspasts} signs into for the shipment register. Two systems of the same post
 * office, and neither one's session is the other's.
 */
@Component
@Getter
public class LatvijasPastsSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_LATVIJASPASTS_BASE_URL", databaseOverride = true)
    private String baseUrl = "https://mans.pasts.lv";

    /**
     * How long to wait between price requests, in milliseconds.
     *
     * <p>A sweep is around fifty calls to a public endpoint that owes this caller nothing. Pacing them is the
     * courtesy that keeps the sweep welcome; it costs the job under a minute either way.
     */
    @VastSetting(env = "VAST_LATVIJASPASTS_REQUEST_DELAY_MS", databaseOverride = true)
    private int requestDelayMillis = 500;
}
