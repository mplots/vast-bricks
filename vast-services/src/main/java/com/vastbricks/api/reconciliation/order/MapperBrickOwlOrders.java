package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.OrderFields;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.tax.FacilitatorTaxes;
import com.vastbricks.api.tax.OrderTaxTypes;
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
        return ReconciledOrder.of(OrderFields.builder()
                .source(Marketplace.BRICK_OWL)
                .orderId(order.getOrderId())
                .orderUrl(OrderLinks.brickOwl(order.getOrderId()))
                .orderDate(sourced.getOrderDate())
                .buyer(order.getBuyerName())
                .buyerUsername(order.getCustomerUsername())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentMethodType()))
                .taxType(OrderTaxTypes.of(order))
                .facilitatorTax(ReconciliationAmount.normalize(FacilitatorTaxes.of(order)))
                .subTotal(ReconciliationAmount.normalize(order.getSubTotal()))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseOrderTotal()))
                .build());
    }
}
