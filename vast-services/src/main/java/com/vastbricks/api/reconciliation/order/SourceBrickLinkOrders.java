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
 * Fetches the received BrickLink orders of the month, exported with the buyer's real name. The export names the buyer
 * either by real name or by username but never both, so the usernames are a separate source of their own.
 */
@Component
@RequiredArgsConstructor
class SourceBrickLinkOrders implements Source<BrickStoreOrder> {

    private final BrickStoreClient brickStoreClient;

    @Override
    public Class<BrickStoreOrder> type() {
        return BrickStoreOrder.class;
    }

    @Override
    public List<BrickStoreOrder> fetch(YearMonth month) {
        return brickStoreClient.listOrders(BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                month.atDay(1),
                month.atEndOfMonth(),
                true
        ));
    }
}
