package com.vastbricks.api.reconciliation.storesync;

import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Marks each collected order the store synchronization holds a record of.
 *
 * <p>Only those, so an order it says nothing about is left stating nothing rather than stating that it was never
 * synchronized. The two read the same on the wire and mean different things to a rule.
 */
@Component
class MapperBrickSyncOrders implements DetailMapper<SourcedBrickSyncOrder> {

    @Override
    public Class<SourcedBrickSyncOrder> type() {
        return SourcedBrickSyncOrder.class;
    }

    @Override
    public void map(List<SourcedBrickSyncOrder> sourced, ReconciledOrders orders) {
        for (var recorded : sourced) {
            orders.find(recorded.getMarketplace(), recorded.getOrderId())
                    .forEach(order -> order.getStoreSync().setOrder(true));
        }
    }
}
