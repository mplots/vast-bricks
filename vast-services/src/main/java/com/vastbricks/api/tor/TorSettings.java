package com.vastbricks.api.tor;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;

@Getter
@Component
class TorSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_TOR_PROXY_HOST", databaseOverride = true)
    private String proxyHost = "127.0.0.1";

    @VastSetting(env = "VAST_TOR_PROXY_PORT", databaseOverride = true)
    private int proxyPort = 8118;

    @VastSetting(env = "VAST_TOR_CONTROL_HOST", databaseOverride = true)
    private String controlHost = "127.0.0.1";

    @VastSetting(env = "VAST_TOR_CONTROL_PORT", databaseOverride = true)
    private int controlPort = 9051;

    @VastSetting(env = "VAST_TOR_CONTROL_PASSWORD", databaseOverride = true, secret = true)
    private String controlPassword = "yourpass";

    @VastSetting(env = "VAST_TOR_IP_ADDRESS_URL", databaseOverride = true)
    private String ipAddressUrl = "https://check.torproject.org/api/ip";

    @VastSetting(env = "VAST_TOR_FALLBACK_IP_ADDRESS_URL", databaseOverride = true)
    private String fallbackIpAddressUrl = "";

    @VastSetting(env = "VAST_TOR_CONNECT_TIMEOUT", databaseOverride = true)
    private Duration connectTimeout = Duration.parse("PT5S");

    @VastSetting(env = "VAST_TOR_READ_TIMEOUT", databaseOverride = true)
    private Duration readTimeout = Duration.parse("PT10S");

    @VastSetting(env = "VAST_TOR_NEW_IP_TIMEOUT", databaseOverride = true)
    private Duration newIpTimeout = Duration.parse("PT100S");

    @VastSetting(env = "VAST_TOR_NEW_IP_INITIAL_POLL_INTERVAL", databaseOverride = true)
    private Duration newIpInitialPollInterval = Duration.parse("PT0.25S");

    @VastSetting(env = "VAST_TOR_NEW_IP_MAX_POLL_INTERVAL", databaseOverride = true)
    private Duration newIpMaxPollInterval = Duration.parse("PT1S");

    @VastSetting(env = "VAST_TOR_DEFAULT_RETRY_STATUSES", databaseOverride = true)
    private Set<Integer> defaultRetryStatuses = Set.of(403);
}
