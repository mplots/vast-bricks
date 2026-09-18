package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.charges.MarketplaceFees;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.OrderMapper;
import com.vastbricks.api.reconciliation.OrderFields;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import com.vastbricks.api.reconciliation.ReconciliationCurrency;
import com.vastbricks.api.reconciliation.ReconciliationPaymentMethod;
import com.vastbricks.api.reconciliation.ReconciliationText;
import com.vastbricks.api.charges.FacilitatorTaxes;
import com.vastbricks.api.charges.OrderTaxTypes;
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
        var reconciled = ReconciledOrder.of(OrderFields.builder()
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
                .marketplaceFee(ReconciliationAmount.normalize(order.getBrickOwlFee()))
                .subTotal(ReconciliationAmount.normalize(order.getSubTotal()))
                .shippingCost(ReconciliationAmount.normalize(order.getShipping()))
                .grandTotal(ReconciliationAmount.normalize(order.getBaseOrderTotal()))
                .refundedAmount(refundedAmount(order))
                .build());
        // Calculated from the order itself rather than collected, so it belongs to the calculated group; set here,
        // the one point this mapper still holds the marketplace's own order.
        reconciled.setMarketplaceFee(ReconciliationAmount.normalize(MarketplaceFees.of(order)));
        return reconciled;
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
