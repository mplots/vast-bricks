package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Merges each BrickLink buyer username onto the order it belongs to. */
@Component
@Order(1)
class MapperBrickLinkUsernames implements DetailMapper<SourcedBrickLinkUsername> {

    @Override
    public Class<SourcedBrickLinkUsername> type() {
        return SourcedBrickLinkUsername.class;
    }

    @Override
    public void map(List<SourcedBrickLinkUsername> sourced, ReconciledOrders orders) {
        for (var username : sourced) {
            orders.find(Marketplace.BRICK_LINK, username.getOrderId())
                    .forEach(order -> order.setBuyerUsername(username.getBuyerUsername()));
        }
    }
}
