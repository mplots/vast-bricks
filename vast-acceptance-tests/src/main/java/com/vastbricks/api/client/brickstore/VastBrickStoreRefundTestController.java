package com.vastbricks.api.client.brickstore;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches {@link BrickStoreClient#getOrderRefund(String)} for logic tests. No endpoint exposes the BrickLink order
 * detail page, so this thin adapter sits in the client's own package. An order the page states no refund for answers
 * with an empty body, which is the {@code null} the client returns.
 */
@RestController
@RequestMapping(path = "/api/test/brickstore-order-refund", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastBrickStoreRefundTestController {

    private final BrickStoreClient brickStoreClient;

    @GetMapping
    BrickStoreOrderRefund findRefund(@RequestParam("orderId") String orderId) {
        return brickStoreClient.getOrderRefund(orderId);
    }
}
