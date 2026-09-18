package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.vastbricks.api.charges.PaymentFees;
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;

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
 * <p>A source nothing is collected from yet has no group here.
 */
@Getter
@JsonPropertyOrder({"order", "gateway", "shipment", "accounting", "stored", "archive", "storeSync", "calculated"})
public class ReconciledOrder {

    /** What the marketplace reported about the order itself, which the rest is reconciled against. */
    private final OrderFields order;

    /** What the payment provider reports about the payment matched to the order. */
    private final GatewayFields gateway = new GatewayFields();

    /** What the shipping provider reports about the shipment sent for the order. */
    private final ShipmentFields shipment = new ShipmentFields();

    /** What the accounting system holds for the order: the invoice that was written for it. */
    private final AccountingFields accounting = new AccountingFields();

    /** What the orders table holds for the order, which is the marketplace's account as the archive kept it. */
    private final StoredFields stored = new StoredFields();

    /** What the store's own order archive holds for the order: the copies it took of the marketplace's documents. */
    private final ArchiveFields archive = new ArchiveFields();

    /** What the store synchronization system holds for the order, which says whether it acted on it at all. */
    private final StoreSyncFields storeSync = new StoreSyncFields();

    /**
     * What this store calculates the marketplace's own commission on the order as. Filled in by the order mapper
     * itself, immediately after building this, rather than by a later detail mapper: the calculation needs the
     * marketplace's own order, which only the order mapper still holds by the time anything else sees this. No
     * public getter, unlike every other field here: it is exposed only through {@link #getCalculated()}, which is
     * what puts it in the {@code calculated} group rather than a {@code marketplaceFee} of its own at the top level.
     */
    @Getter(AccessLevel.NONE)
    @Setter
    private BigDecimal marketplaceFee;

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
     *
     * <p>Neither fee is stated when there is no target invoice at all - nothing left to invoice is nothing left to
     * have cost a commission or a payment charge either, whether that is because the order came back in full or
     * because there is no grand total to have priced one from in the first place.
     */
    public CalculatedFields getCalculated() {
        var targetInvoice = targetInvoice();
        boolean nothingToInvoice = targetInvoice == null || targetInvoice.signum() == 0;
        return new CalculatedFields(targetInvoice, nothingToInvoice ? null : marketplaceFee,
                nothingToInvoice ? null : paymentFee());
    }

    /**
     * Needs nothing the order mapper alone holds - only the payment method and grand total {@link OrderFields}
     * already carries - so unlike the marketplace fee this is worked out here, on every read, rather than set once
     * at mapping time. Normalized here rather than by a mapper, because a mapper is where every other amount is, but
     * a rate applied to an already-normalized grand total states more decimals than the normalization it started
     * from.
     */
    private BigDecimal paymentFee() {
        return ReconciliationAmount.normalize(
                PaymentFees.of(order.getPaymentMethod(), order.getGrandTotal(), order.getCountry()));
    }

    private BigDecimal targetInvoice() {
        var grandTotal = order.getGrandTotal();
        if (grandTotal == null) {
            return null;
        }
        if (refundedInFullWithNoPayment(grandTotal)) {
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

    /**
     * Whether the marketplace says the whole of this order came back and no payment was ever matched to it. Such an
     * order has no target to invoice for at all rather than a target of nothing: with no payment collected there is
     * no account of the money to subtract a refund from, so what is left is not a figure this reconciliation arrived
     * at but a question it cannot answer.
     */
    private boolean refundedInFullWithNoPayment(BigDecimal grandTotal) {
        var refunded = order.getRefundedAmount();
        return gateway.getPaidAmount() == null && refunded != null && refunded.compareTo(grandTotal) == 0;
    }
}
