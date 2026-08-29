package com.vastbricks.api.tor;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;

@Getter
@Component
class TorSettings extends DatabaseBackedSettings {

    @Value("${VAST_TOR_PROXY_HOST:127.0.0.1}")
    private String proxyHost;

    @Value("${VAST_TOR_PROXY_PORT:8118}")
    private int proxyPort;

    @Value("${VAST_TOR_CONTROL_HOST:127.0.0.1}")
    private String controlHost;

    @Value("${VAST_TOR_CONTROL_PORT:9051}")
    private int controlPort;

    @Value("${VAST_TOR_CONTROL_PASSWORD:yourpass}")
    private String controlPassword;

    @Value("${VAST_TOR_IP_ADDRESS_URL:https://check.torproject.org/api/ip}")
    private String ipAddressUrl;

    @Value("${VAST_TOR_FALLBACK_IP_ADDRESS_URL:}")
    private String fallbackIpAddressUrl;

    @Value("${VAST_TOR_CONNECT_TIMEOUT:PT5S}")
    private Duration connectTimeout;

    @Value("${VAST_TOR_READ_TIMEOUT:PT10S}")
    private Duration readTimeout;

    @Value("${VAST_TOR_NEW_IP_TIMEOUT:PT100S}")
    private Duration newIpTimeout;

    @Value("${VAST_TOR_NEW_IP_INITIAL_POLL_INTERVAL:PT0.25S}")
    private Duration newIpInitialPollInterval;

    @Value("${VAST_TOR_NEW_IP_MAX_POLL_INTERVAL:PT1S}")
    private Duration newIpMaxPollInterval;

    @Value("${VAST_TOR_DEFAULT_RETRY_STATUSES:403}")
    private Set<Integer> defaultRetryStatuses;
}
