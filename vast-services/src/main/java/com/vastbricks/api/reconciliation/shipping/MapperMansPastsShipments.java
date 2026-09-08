package com.vastbricks.api.reconciliation.shipping;

import com.vastbricks.api.client.manspasts.MansPastsShipment;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges what the post office charged to ship an order onto that order.
 *
 * <p>A shipment names its order in the notes the store wrote on it, which is where both marketplaces put the order
 * it is for: {@code Order #32400001}. It names no marketplace, so the notes are read against every collected order
 * rather than one mapper per marketplace guessing at the other's orders — the same reading a bank entry gets, and
 * through the same key. Notes naming two collected orders name neither: a guessed shipment would read exactly like a
 * matched one.
 *
 * <p>Every shipment naming one order is summed rather than the first one winning. An order shipped in two parcels
 * was shipped twice for one order, and both parcels are postage the store paid for it, so the total is what shipping
 * that order cost. This is the reading the bank transfers already get for the same reason; if one parcel's own cost
 * is ever wanted, that is a field of its own rather than a different sum here.
 */
@Component
@Order(8)
class MapperMansPastsShipments implements DetailMapper<MansPastsShipment> {

    @Override
    public Class<MansPastsShipment> type() {
        return MansPastsShipment.class;
    }

    @Override
    public void map(List<MansPastsShipment> sourced, ReconciledOrders orders) {
        // Identity, not equality: two collected orders may state the same fields, and each is shipped on its own.
        Map<ReconciledOrder, BigDecimal> shipped = new IdentityHashMap<>();
        for (var shipment : sourced) {
            var order = namedOrder(shipment, orders);
            if (order == null || shipment.getTotalAmount() == null) {
                continue;
            }
            shipped.merge(order, shipment.getTotalAmount(), BigDecimal::add);
        }
        shipped.forEach((order, total) -> order.getShipment().setTotalAmount(ReconciliationAmount.normalize(total)));
    }

    /** The one collected order this shipment's notes name, or {@code null} when they name none or several. */
    private ReconciledOrder namedOrder(MansPastsShipment shipment, ReconciledOrders orders) {
        var named = orders.findNamedIn(shipment.getNotes());
        return named.size() == 1 ? named.getFirst() : null;
    }
}
