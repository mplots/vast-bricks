package com.vastbricks.api.order;

import com.vastbricks.api.order.OrderPayload.OrderResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The store's orders, as the import last left them.
 *
 * <p>It reads and nothing else: the rows are written by {@link OrderImport} out of the archive, so a screen showing
 * them stale is a job that has not run rather than a screen to add a button to.
 */
@Service
@RequiredArgsConstructor
class OrderService {

    private final OrderRepository orders;

    /** The orders placed in a range of days, newest first, for the tenant bound to the request. */
    List<OrderResponse> findOrders(LocalDate from, LocalDate to) {
        // Days in, instants out: an order date is a moment, and the day it is asked for runs to the start of the
        // next one so an order placed in the last second of the day is in the day it was placed.
        Instant start = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return orders.findByOrderDateGreaterThanEqualAndOrderDateLessThanOrderByOrderDateDescIdDesc(start, end)
                .stream()
                .map(OrderResponse::new)
                .toList();
    }
}
