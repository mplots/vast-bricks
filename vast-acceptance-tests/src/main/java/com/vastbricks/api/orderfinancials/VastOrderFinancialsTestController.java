package com.vastbricks.api.orderfinancials;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches {@link OrderFinancialsService} for logic tests. No public endpoint exposes order financials yet, so this
 * thin adapter sits in the feature's own package and lets the feature stay package-private.
 */
@RestController
@RequestMapping(path = "/api/test/order-financials", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastOrderFinancialsTestController {

    private final OrderFinancialsService orderFinancialsService;

    @GetMapping
    OrderFinancialsResponse findFinancials(
            @RequestParam("orderId") String orderId,
            @RequestParam("source") String source
    ) {
        return orderFinancialsService.findFinancials(orderId, source);
    }
}
