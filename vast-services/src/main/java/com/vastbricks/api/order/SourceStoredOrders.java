package com.vastbricks.api.order;

import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import com.vastbricks.api.reconciliation.Source;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Reads the stored orders for the period being reconciled.
 *
 * <p>A reconciliation source like any other, and the only one that reaches no provider: the rows are already here,
 * put there by the import job out of the archive. It costs one query and joins the parallel fetch beside the
 * marketplaces it is going to be compared against.
 *
 * <p>It lives in the orders feature rather than under {@code reconciliation.order}, where the marketplace sources
 * live, because this is the feature that owns the table. The dependency then runs one way - the orders feature
 * already reads reconciliation's normalizers and its {@link Source} boundary - where a source in reconciliation
 * reaching into this table would have made the two features depend on each other.
 */
@Component
@RequiredArgsConstructor
class SourceStoredOrders implements Source<SourcedStoredOrder> {

    private final OrderRepository orders;

    @Override
    public Class<SourcedStoredOrder> type() {
        return SourcedStoredOrder.class;
    }

    @Override
    public List<SourcedStoredOrder> fetch(ReconciliationPeriod period) {
        // The same window the orders screen reads, so what a rule compares against is what that screen shows: days
        // in, instants out, the last day running to the start of the next one.
        Instant from = period.getFrom().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = period.getTo().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return orders.findByOrderDateGreaterThanEqualAndOrderDateLessThanOrderByOrderDateDescIdDesc(from, to).stream()
                .map(order -> new SourcedStoredOrder(order.getSource(), order.getOrderId(), order))
                .toList();
    }
}
