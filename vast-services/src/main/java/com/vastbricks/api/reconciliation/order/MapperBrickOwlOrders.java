package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickowl.BrickOwlOrderItem;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Turns the fetched BrickOwl orders into reconciled orders. */
@Component
@Order(2)
class MapperBrickOwlOrders implements OrderMapper<SourcedBrickOwlOrder> {

    @Override
    public Class<SourcedBrickOwlOrder> type() {
        return SourcedBrickOwlOrder.class;
    }

    @Override
    public List<ReconciledOrder> map(List<SourcedBrickOwlOrder> sourced) {
        return sourced.stream().map(this::toReconciledOrder).toList();
    }

    private ReconciledOrder toReconciledOrder(SourcedBrickOwlOrder sourced) {
        var order = sourced.getOrder();
        return ReconciledOrder.builder()
                .source(Marketplace.BRICK_OWL)
                .orderId(order.getOrderId())
                .orderDate(sourced.getOrderDate())
                .buyer(order.getBuyerName())
                .buyerUsername(order.getCustomerUsername())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentMethodType()))
                .subTotal(ReconciliationAmount.normalize(order.getSubTotal()))
                .itemsSubTotal(ReconciliationAmount.normalize(sumItemBasePrices(sourced.getItems())))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseOrderTotal()))
                .build();
    }

    private BigDecimal sumItemBasePrices(List<BrickOwlOrderItem> items) {
        return items.stream()
                .filter(item -> item.getBasePrice() != null && item.getOrderedQuantity() != null)
                .map(item -> item.getBasePrice().multiply(item.getOrderedQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
