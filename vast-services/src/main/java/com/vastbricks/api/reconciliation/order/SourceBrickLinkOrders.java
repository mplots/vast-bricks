package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderRefund;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import com.vastbricks.api.reconciliation.ParallelTasks;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the received BrickLink orders in the selected date range, exported with the buyer's real name. The export names the buyer
 * either by real name or by username but never both, so the usernames are a separate source of their own.
 *
 * <p>The export names no refund at all, so the refund of each order it reports as cancelled is fetched from that
 * order's detail page, every page started before the first is joined. The pages need the order ids the export
 * returned, so they stay in this source exactly as the BrickOwl detail batches stay in theirs.
 *
 * <p>Only a cancelled order is asked about: a page per order would be two hundred fetches a month against the handful
 * of orders a refund plausibly belongs to. The cost is that a partial refund on an order of another status stays
 * uncollected, and the rule holding the two sides of a refund against each other goes on reporting it.
 */
@Component
@RequiredArgsConstructor
class SourceBrickLinkOrders implements Source<SourcedBrickLinkOrder> {

    private static final String CANCELLED = "cancelled";

    private final BrickStoreClient brickStoreClient;

    @Override
    public Class<SourcedBrickLinkOrder> type() {
        return SourcedBrickLinkOrder.class;
    }

    @Override
    public List<SourcedBrickLinkOrder> fetch(ReconciliationPeriod period) {
        var exported = brickStoreClient.listOrders(BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                period.getFrom(),
                period.getTo(),
                true
        ));

        try (var tasks = new ParallelTasks()) {
            var refunds = new ArrayList<Supplier<BrickStoreOrderRefund>>();
            for (var order : exported) {
                refunds.add(cancelled(order) ? startRefund(tasks, order) : () -> null);
            }

            var orders = new ArrayList<SourcedBrickLinkOrder>();
            for (var index = 0; index < exported.size(); index++) {
                orders.add(new SourcedBrickLinkOrder(exported.get(index), refunds.get(index).get()));
            }
            return List.copyOf(orders);
        }
    }

    private Supplier<BrickStoreOrderRefund> startRefund(ParallelTasks tasks, BrickStoreOrder order) {
        var orderId = order.getOrderId().toString();
        return tasks.start(() -> brickStoreClient.getOrderRefund(orderId));
    }

    private boolean cancelled(BrickStoreOrder order) {
        var status = order.getStatus();
        return order.getOrderId() != null
                && status != null
                && CANCELLED.equals(status.trim().toLowerCase(Locale.ROOT));
    }
}
