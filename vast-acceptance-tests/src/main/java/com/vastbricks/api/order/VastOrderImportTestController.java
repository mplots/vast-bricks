package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Reaches the orders {@link OrderImport} stores, for acceptance tests. No public endpoint exposes them yet, so this
 * thin adapter sits in the feature's own package and lets the feature stay package-private.
 *
 * <p>Reading and writing one row by its primary key is here because that is where tenant isolation is asserted: a
 * caller holding another tenant's id is the case a derived query would not catch on its own.
 */
@RestController
@RequestMapping(path = "/api/test/orders", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastOrderImportTestController {

    private final OrderRepository orders;

    @GetMapping
    List<OrderPayload.OrderResponse> list() {
        // The feature's own response shape, which this controller can reach by sitting in its package: a second
        // account of an order here would be one more thing to keep in step with the first. The target invoice is
        // left unstated: what this endpoint is for is tenant isolation over the row itself, not the euro conversion
        // the real endpoint layers on top of it.
        return orders.findAllByOrderByOrderDateDescIdDesc().stream()
                .map(order -> new OrderPayload.OrderResponse(order, null))
                .toList();
    }

    @GetMapping("/count")
    Map<String, Long> count() {
        return Map.of("count", orders.count());
    }

    @PostMapping
    Map<String, Object> create(@RequestParam("source") String source, @RequestParam("orderId") String orderId) {
        var order = new Order(OrderSource.valueOf(source), orderId);
        order.setOrderDate(Instant.parse("2026-01-01T00:00:00Z"));
        order.setArchivedAt(Instant.parse("2026-01-01T00:00:00Z"));
        Order saved = orders.save(order);
        return Map.of("id", saved.getId(), "tenantId", saved.getTenantId());
    }

    @GetMapping("/{id}")
    Map<String, Object> read(@PathVariable("id") Long id) {
        return orders.findById(id)
                .map(order -> Map.<String, Object>of(
                        "found", true, "orderId", order.getOrderId(), "buyer", String.valueOf(order.getBuyer())))
                .orElse(Map.of("found", false));
    }

    @PutMapping("/{id}")
    Map<String, Object> update(@PathVariable("id") Long id, @RequestParam("buyerName") String buyerName) {
        return orders.findById(id)
                .map(order -> {
                    order.setBuyer(buyerName);
                    orders.save(order);
                    return Map.<String, Object>of("updated", true);
                })
                .orElse(Map.of("updated", false));
    }
}
