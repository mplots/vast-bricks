package com.vastbricks.api.client.manspasts;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches {@link MansPastsClient} for logic tests. No public endpoint exposes the shipment register — reconciliation
 * collects it as one source among several — so this thin adapter states one page of it, which is what the scenarios
 * about reading the provider's own export are asserted against.
 */
@RestController
@RequestMapping(path = "/api/test/manspasts/shipments", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastMansPastsShipmentTestController {

    private final MansPastsClient mansPastsClient;

    @GetMapping
    List<MansPastsShipment> shipments(@RequestParam(name = "page", defaultValue = "1") int page) {
        return mansPastsClient.listShipments(page);
    }
}
