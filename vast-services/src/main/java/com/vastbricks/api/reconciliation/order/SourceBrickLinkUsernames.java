package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import com.vastbricks.api.setup.provideraccount.Provider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the buyer usernames of the received BrickLink orders in the selected date range. It is the same export as the orders, asked
 * for without real names, so the buyer it reports is the username; requesting it separately lets both exports run in
 * the sourcing stage's own fan-out instead of one waiting inside the other.
 */
@Component
@RequiredArgsConstructor
class SourceBrickLinkUsernames implements Source<SourcedBrickLinkUsername> {

    private final BrickStoreClient brickStoreClient;
    private final StoreOperatingPeriod storeOperatingPeriod;

    @Override
    public Class<SourcedBrickLinkUsername> type() {
        return SourcedBrickLinkUsername.class;
    }

    @Override
    public List<SourcedBrickLinkUsername> fetch(ReconciliationPeriod period) {
        // The same export as the orders, so it is asked for the same narrowed period: a username of an order this
        // tenant may not reconcile is a username it has no order to put on.
        var boundedPeriod = storeOperatingPeriod.narrow(Provider.BRICK_LINK, period);
        if (boundedPeriod.isEmpty()) {
            return List.of();
        }

        var orders = brickStoreClient.listOrders(BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                boundedPeriod.get().getFrom(),
                boundedPeriod.get().getTo(),
                false
        ));
        return orders.stream()
                .filter(order -> order.getOrderId() != null)
                .map(order -> new SourcedBrickLinkUsername(order.getOrderId().toString(), order.getBuyer()))
                .toList();
    }
}
