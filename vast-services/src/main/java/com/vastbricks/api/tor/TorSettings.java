package com.vastbricks.api.tor;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Set;

@Getter
@Component
class TorSettings {

    private final String proxyHost;
    private final int proxyPort;
    private final String controlHost;
    private final int controlPort;
    private final String controlPassword;
    private final String ipAddressUrl;
    private final Duration newIpTimeout;
    private final Set<Integer> defaultRetryStatuses;

    public TorSettings(
            @Value("${VAST_TOR_PROXY_HOST:127.0.0.1}") String proxyHost,
            @Value("${VAST_TOR_PROXY_PORT:8118}") int proxyPort,
            @Value("${VAST_TOR_CONTROL_HOST:127.0.0.1}") String controlHost,
            @Value("${VAST_TOR_CONTROL_PORT:9051}") int controlPort,
            @Value("${VAST_TOR_CONTROL_PASSWORD:yourpass}") String controlPassword,
            @Value("${VAST_TOR_IP_ADDRESS_URL:https://check.torproject.org/api/ip}") String ipAddressUrl,
            @Value("${VAST_TOR_NEW_IP_TIMEOUT:PT100S}") Duration newIpTimeout,
            @Value("${VAST_TOR_DEFAULT_RETRY_STATUSES:403}") Set<Integer> defaultRetryStatuses
    ) {
        this.proxyHost = proxyHost;
        this.proxyPort = proxyPort;
        this.controlHost = controlHost;
        this.controlPort = controlPort;
        this.controlPassword = controlPassword;
        this.ipAddressUrl = ipAddressUrl;
        this.newIpTimeout = newIpTimeout;
        this.defaultRetryStatuses = defaultRetryStatuses;
    }
}
