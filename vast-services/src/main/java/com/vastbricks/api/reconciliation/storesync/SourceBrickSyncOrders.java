package com.vastbricks.api.reconciliation.storesync;

import com.vastbricks.api.bricksync.BrickSyncOrders;
import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import com.vastbricks.api.reconciliation.Source;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Lists the orders the store synchronization holds a record of.
 *
 * <p>A source that reads a directory rather than a provider, as the archive's is: BrickSync runs beside the store
 * rather than answering questions over HTTP, and what it has done is on its disk.
 *
 * <p>The period is not asked of it. BrickSync names a file after the marketplace and the order id and nothing else,
 * so there is no date in the directory to narrow by; one listing answers for the whole month and the mapper drops
 * whatever the month did not collect.
 */
@Component
@RequiredArgsConstructor
class SourceBrickSyncOrders implements Source<SourcedBrickSyncOrder> {

    private final BrickSyncOrders brickSyncOrders;

    @Override
    public Class<SourcedBrickSyncOrder> type() {
        return SourcedBrickSyncOrder.class;
    }

    @Override
    public List<SourcedBrickSyncOrder> fetch(ReconciliationPeriod period) {
        return brickSyncOrders.synchronizedOrderKeys().stream()
                .map(SourceBrickSyncOrders::sourced)
                .filter(Objects::nonNull)
                .toList();
    }

    /**
     * One key as the reconciled orders name an order. The synchronization answers in the archive's vocabulary and
     * reconciliation labels a marketplace in its own, so this is the one place the two are held together.
     */
    private static SourcedBrickSyncOrder sourced(String key) {
        for (OrderSource source : OrderSource.values()) {
            String prefix = source.prefix() + "-";
            if (key.startsWith(prefix)) {
                return new SourcedBrickSyncOrder(marketplace(source), key.substring(prefix.length()));
            }
        }
        return null;
    }

    private static String marketplace(OrderSource source) {
        return source == OrderSource.BRICKLINK ? Marketplace.BRICK_LINK : Marketplace.BRICK_OWL;
    }
}
