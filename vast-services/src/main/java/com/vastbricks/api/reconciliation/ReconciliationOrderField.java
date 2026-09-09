package com.vastbricks.api.reconciliation;

import static com.vastbricks.api.reconciliation.ReconciliationFieldSource.ACCOUNTING;
import static com.vastbricks.api.reconciliation.ReconciliationFieldSource.CALCULATED;
import static com.vastbricks.api.reconciliation.ReconciliationFieldSource.GATEWAY;
import static com.vastbricks.api.reconciliation.ReconciliationFieldSource.ORDER;
import static com.vastbricks.api.reconciliation.ReconciliationFieldSource.SHIPMENT;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Every collected order field a rule may cite in a failure and a client may read as a column, named as the order
 * exposes it: {@code <source>.<field>}, the path a value actually sits at. A client can map a failure or a column
 * straight onto the value it already holds by walking that path, and reads the source off the field rather than off
 * a convention in its name.
 *
 * <p>Two sources may state the same field, and the path is what keeps them apart, so nothing has to be renamed
 * around anything: {@code order.refundedAmount} and {@code gateway.refundedAmount} are one quantity claimed twice,
 * which is exactly what a rule comparing them is for.
 *
 * <p>The constants follow the order the fields are exposed in, so this enum reads as the roster it is reported as.
 */
@Getter
@RequiredArgsConstructor
public enum ReconciliationOrderField {

    ORDER_SOURCE("order.source", ORDER),
    ORDER_ID("order.orderId", ORDER),
    ORDER_DATE("order.orderDate", ORDER),
    ORDER_BUYER("order.buyer", ORDER),
    ORDER_BUYER_USERNAME("order.buyerUsername", ORDER),
    ORDER_PAYMENT_METHOD("order.paymentMethod", ORDER),
    ORDER_TAX_TYPE("order.taxType", ORDER),
    ORDER_FACILITATOR_TAX("order.facilitatorTax", ORDER),
    ORDER_SUB_TOTAL("order.subTotal", ORDER),
    ORDER_SHIPPING_COST("order.shippingCost", ORDER),
    ORDER_GRAND_TOTAL("order.grandTotal", ORDER),
    ORDER_REFUNDED_AMOUNT("order.refundedAmount", ORDER),

    GATEWAY_PAID_AMOUNT("gateway.paidAmount", GATEWAY),
    GATEWAY_FACILITATOR_TAX("gateway.facilitatorTax", GATEWAY),
    GATEWAY_REFUNDED_AMOUNT("gateway.refundedAmount", GATEWAY),

    SHIPMENT_TOTAL_AMOUNT("shipment.totalAmount", SHIPMENT),

    ACCOUNTING_SUB_TOTAL("accounting.subTotal", ACCOUNTING),
    ACCOUNTING_VAT("accounting.vat", ACCOUNTING),
    ACCOUNTING_GRAND_TOTAL("accounting.grandTotal", ACCOUNTING),

    CALCULATED_TARGET_INVOICE("calculated.targetInvoice", CALCULATED);

    @JsonValue
    private final String name;

    private final ReconciliationFieldSource source;
}
