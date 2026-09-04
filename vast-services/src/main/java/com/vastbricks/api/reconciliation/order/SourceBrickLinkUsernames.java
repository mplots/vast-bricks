package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the buyer usernames of the month's received BrickLink orders. It is the same export as the orders, asked
 * for without real names, so the buyer it reports is the username; requesting it separately lets both exports run in
 * the sourcing stage's own fan-out instead of one waiting inside the other.
 */
@Component
@RequiredArgsConstructor
class SourceBrickLinkUsernames implements Source<SourcedBrickLinkUsername> {

    private final BrickStoreClient brickStoreClient;

    @Override
    public Class<SourcedBrickLinkUsername> type() {
        return SourcedBrickLinkUsername.class;
    }

    @Override
    public List<SourcedBrickLinkUsername> fetch(YearMonth month) {
        var orders = brickStoreClient.listOrders(BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                month.atDay(1),
                month.atEndOfMonth(),
                false
        ));
        return orders.stream()
                .filter(order -> order.getOrderId() != null)
                .map(order -> new SourcedBrickLinkUsername(order.getOrderId().toString(), order.getBuyer()))
                .toList();
    }
}
