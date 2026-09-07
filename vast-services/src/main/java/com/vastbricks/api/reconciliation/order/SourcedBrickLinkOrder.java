package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderRefund;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One BrickLink order: what the export reported and the refund only the order detail page states. The refund is
 * {@code null} where the page states none and where no page was asked for at all.
 */
@Getter
@AllArgsConstructor
class SourcedBrickLinkOrder {

    private final BrickStoreOrder order;
    private final BrickStoreOrderRefund refund;
}
