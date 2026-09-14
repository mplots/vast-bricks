package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import com.vastbricks.api.reconciliation.StoredFields;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges each stored order onto the collected order it is a copy of.
 *
 * <p>Matched by marketplace and order id, which is the same pairing the import writes the row under, so a stored
 * order reaching no collected one is a row for an order this period did not collect and is dropped - as every detail
 * mapper drops what matches nothing. Whether a collected order having no stored row matters is a rule's decision.
 */
@Component
@Order(5)
class MapperStoredOrders implements DetailMapper<SourcedStoredOrder> {

    @Override
    public Class<SourcedStoredOrder> type() {
        return SourcedStoredOrder.class;
    }

    @Override
    public void map(List<SourcedStoredOrder> sourced, ReconciledOrders orders) {
        for (SourcedStoredOrder stored : sourced) {
            orders.find(marketplaceOf(stored.getSource()), stored.getOrderId())
                    .forEach(collected -> apply(collected.getStored(), stored.getOrder()));
        }
    }

    /** How the marketplace is spelled where orders are matched across systems, which is not how a row stores it. */
    private static String marketplaceOf(OrderSource source) {
        return source == OrderSource.BRICKOWL ? Marketplace.BRICK_OWL : Marketplace.BRICK_LINK;
    }

    private static void apply(StoredFields fields, com.vastbricks.api.order.Order order) {
        fields.setPresent(true);
        // Stored as a moment and compared as a day, which is what the marketplace's own account states: BrickLink's
        // accounting export names a day and no time of day, so the moment is midnight UTC of the day it named.
        fields.setOrderDate(order.getOrderDate() == null ? null : order.getOrderDate().atZone(ZoneOffset.UTC).toLocalDate());
        fields.setBuyer(order.getBuyer());
        fields.setBuyerUsername(order.getBuyerUsername());
        fields.setItemCount(order.getItemCount());
        fields.setLotCount(order.getLotCount());
        fields.setPaymentMethod(order.getPaymentMethod());
        fields.setCurrency(order.getCurrency());
        fields.setTaxType(order.getTaxType());
        fields.setFacilitatorTax(order.getFacilitatorTax());
        fields.setSubTotal(order.getSubTotal());
        fields.setShippingCost(order.getShippingCost());
        fields.setGrandTotal(order.getGrandTotal());
        fields.setRefundedAmount(order.getRefundedAmount());
    }
}
