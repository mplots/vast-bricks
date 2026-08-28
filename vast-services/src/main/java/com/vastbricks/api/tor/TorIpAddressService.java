package com.vastbricks.api.tor;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
class TorIpAddressService {

    private final TorSettings settings;
    private final RestClient torRestClient;

    @Autowired
    public TorIpAddressService(TorSettings settings, TorRestClientFactory torRestClientFactory) {
        this.settings = settings;
        this.torRestClient = torRestClientFactory.create(
                TorRestClientOptions.builder()
                        .maxRequestsBeforeNewCircuit(0)
                        .build()
        );
    }

    public String currentIpAddress() {
        var response = torRestClient.get()
                .uri(settings.getIpAddressUrl())
                .retrieve()
                .body(TorIpAddressResponse.class);

        if (response == null || response.getIpAddress() == null || response.getIpAddress().isBlank()) {
            throw new TorCircuitException("Tor IP lookup did not return an IP address.");
        }

        return response.getIpAddress();
    }
}
