package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.tax.FacilitatorTaxes;
import com.vastbricks.api.tax.OrderTaxTypes;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Turns the exported BrickLink orders into reconciled orders. The buyer username arrives with its own mapper. */
@Component
@Order(1)
class MapperBrickLinkOrders implements OrderMapper<BrickStoreOrder> {

    @Override
    public Class<BrickStoreOrder> type() {
        return BrickStoreOrder.class;
    }

    @Override
    public List<ReconciledOrder> map(List<BrickStoreOrder> sourced) {
        return sourced.stream().map(this::toReconciledOrder).toList();
    }

    private ReconciledOrder toReconciledOrder(BrickStoreOrder order) {
        return ReconciledOrder.builder()
                .source(Marketplace.BRICK_LINK)
                .orderId(order.getOrderId() == null ? null : order.getOrderId().toString())
                .orderDate(order.getOrderDate())
                .buyer(order.getBuyer())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentType()))
                .taxType(OrderTaxTypes.of(order))
                .facilitatorTax(ReconciliationAmount.normalize(FacilitatorTaxes.of(order)))
                .subTotal(ReconciliationAmount.normalize(order.getTotal()))
                .itemsSubTotal(ReconciliationAmount.normalize(sumItemPrices(order)))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseGrandTotal()))
                .build();
    }

    private BigDecimal sumItemPrices(BrickStoreOrder order) {
        if (order.getItems() == null) {
            return null;
        }
        return order.getItems().stream()
                .filter(item -> item.getPrice() != null && item.getQuantity() != null)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
