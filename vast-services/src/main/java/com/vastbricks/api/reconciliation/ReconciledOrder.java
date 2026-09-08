package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import java.math.BigDecimal;
import lombok.Getter;

/**
 * One item of the reconciled order list: every account of one order, each under the source that stated it. An order
 * mapper builds the marketplace's account and detail mappers fill the others in, so it is mutable for the length of
 * the mapping stage; that stage is single-threaded and the rule stage only reads.
 *
 * <p>The sources are groups rather than name prefixes, which is what lets two of them state the same field — a
 * facilitator tax, a refund — without either having to be renamed around the other. A field is addressed as
 * {@code <source>.<field>} throughout: that is how the roster names it, how a failure cites it, and how the screen
 * asks for it as a column.
 *
 * <p>A source nothing is collected from yet has no group here. The accounting source is declared on
 * {@link ReconciliationFieldSource} and will gain one when something collects it.
 */
@Getter
@JsonPropertyOrder({"order", "gateway", "shipment", "calculated"})
public class ReconciledOrder {

    /** What the marketplace reported about the order itself, which the rest is reconciled against. */
    private final OrderFields order;

    /** What the payment provider reports about the payment matched to the order. */
    private final GatewayFields gateway = new GatewayFields();

    /** What the shipping provider reports about the shipment sent for the order. */
    private final ShipmentFields shipment = new ShipmentFields();

    private ReconciledOrder(OrderFields order) {
        this.order = order;
    }

    /** A reconciled order with the marketplace's account of it and nothing else collected yet. */
    public static ReconciledOrder of(OrderFields order) {
        return new ReconciledOrder(order);
    }

    /**
     * What reconciliation derives from the accounts above. It is built on every read rather than held, so it always
     * states what the current fields come to; that is also why it carries no setter.
     */
    public CalculatedFields getCalculated() {
        return new CalculatedFields(targetInvoice());
    }

    private BigDecimal targetInvoice() {
        var grandTotal = order.getGrandTotal();
        if (grandTotal == null) {
            return null;
        }
        var facilitatorTax = order.getFacilitatorTax();
        var target = facilitatorTax == null ? grandTotal : grandTotal.subtract(facilitatorTax);
        var refunded = gateway.getRefundedAmount();
        if (refunded == null) {
            return target;
        }
        return target.subtract(refunded).max(BigDecimal.ZERO);
    }
}
