package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.OrderFields;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationCurrency;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.reconciliation.ReconciliationText;
import com.vastbricks.api.tax.FacilitatorTaxes;
import com.vastbricks.api.tax.OrderTaxTypes;
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
        return ReconciledOrder.of(OrderFields.builder()
                .source(Marketplace.BRICK_OWL)
                .orderId(order.getOrderId())
                .orderDate(sourced.getOrderDate())
                .buyer(ReconciliationText.normalize(order.getBuyerName()))
                .buyerUsername(ReconciliationText.normalize(order.getCustomerUsername()))
                .itemCount(order.getTotalQuantity())
                .lotCount(order.getTotalLots())
                .paymentMethod(ReconciliationPaymentMethod.normalize(order.getPaymentMethodType()))
                .currency(ReconciliationCurrency.normalize(order.getPaymentCurrency()))
                .taxType(OrderTaxTypes.of(order))
                .facilitatorTax(ReconciliationAmount.normalize(FacilitatorTaxes.of(order)))
                .subTotal(ReconciliationAmount.normalize(order.getSubTotal()))
                .shippingCost(ReconciliationAmount.normalize(order.getShipping()))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseOrderTotal()))
                .refundedAmount(refundedAmount(order))
                .build());
    }

    /**
     * BrickOwl states a refund total on every order, writing {@code 0.00} where nothing came back, so a zero is the
     * marketplace reporting no refund and is collected as no amount rather than as an amount of nothing.
     */
    private BigDecimal refundedAmount(BrickOwlOrder order) {
        var refundTotal = ReconciliationAmount.normalize(order.getRefundTotal());
        return refundTotal == null || refundTotal.signum() == 0 ? null : refundTotal;
    }
}
