package com.vastbricks.api.order;

import com.vastbricks.api.order.OrderPayload.CountryOrders;
import com.vastbricks.api.order.OrderPayload.OrderResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
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
        return ordersIn(from, to).stream()
                .map(OrderResponse::new)
                .toList();
    }

    /**
     * How many of a range's orders went to each country, the largest share first.
     *
     * <p>Counted over the rows rather than by the database, which is what keeps every query this feature makes a
     * derived one Hibernate can stamp the tenant onto. A store's range is thousands of rows at the very most, and
     * they are rows this tenant is reading either way - the screen beside this one lists the same ones in full.
     */
    List<CountryOrders> findCountries(LocalDate from, LocalDate to) {
        // A HashMap because the orders a marketplace stated no country for are a share of their own, and null is how
        // the row states it. They are one slice the screen names rather than orders left out of the total.
        Map<String, Long> counted = new HashMap<>();
        for (Order order : ordersIn(from, to)) {
            counted.merge(order.getCountry(), 1L, Long::sum);
        }
        return counted.entrySet().stream()
                .map(country -> new CountryOrders(country.getKey(), country.getValue()))
                // Largest first, and by country where two are equal, so a range redrawn reads the same way twice.
                .sorted(Comparator.comparingLong(CountryOrders::getOrders).reversed()
                        .thenComparing(country -> StringUtils.defaultString(country.getCountry())))
                .toList();
    }

    /** The orders of a range of days, newest first. Days in, instants out, which is what the rows are dated by. */
    private List<Order> ordersIn(LocalDate from, LocalDate to) {
        // The day asked for runs to the start of the next one, so an order placed in its last second is in it.
        Instant start = from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return orders.findByOrderDateGreaterThanEqualAndOrderDateLessThanOrderByOrderDateDescIdDesc(start, end);
    }
}
