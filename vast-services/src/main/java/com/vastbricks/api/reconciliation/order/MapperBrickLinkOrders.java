package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.OrderFields;
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
class MapperBrickLinkOrders implements OrderMapper<SourcedBrickLinkOrder> {

    @Override
    public Class<SourcedBrickLinkOrder> type() {
        return SourcedBrickLinkOrder.class;
    }

    @Override
    public List<ReconciledOrder> map(List<SourcedBrickLinkOrder> sourced) {
        return sourced.stream().map(this::toReconciledOrder).toList();
    }

    private ReconciledOrder toReconciledOrder(SourcedBrickLinkOrder sourced) {
        var order = sourced.getOrder();
        var orderId = order.getOrderId() == null ? null : order.getOrderId().toString();
        return ReconciledOrder.of(OrderFields.builder()
                .source(Marketplace.BRICK_LINK)
                .orderId(orderId)
                .orderUrl(OrderLinks.brickLink(orderId))
                .orderDate(order.getOrderDate())
                .buyer(order.getBuyer())
                .itemCount(order.getTotalItems())
                .lotCount(order.getTotalLots())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentType()))
                .taxType(OrderTaxTypes.of(order))
                .facilitatorTax(ReconciliationAmount.normalize(FacilitatorTaxes.of(order)))
                .subTotal(ReconciliationAmount.normalize(order.getTotal()))
                .shippingCost(ReconciliationAmount.normalize(order.getShipping()))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseGrandTotal()))
                // A page stating no refund, and an order no page was asked for, both leave the field absent: that is
                // already the marketplace saying no money came back.
                .refundedAmount(refundedAmount(sourced))
                .build());
    }

    private BigDecimal refundedAmount(SourcedBrickLinkOrder sourced) {
        return sourced.getRefund() == null
                ? null
                : ReconciliationAmount.normalize(sourced.getRefund().getAmount());
    }
}
