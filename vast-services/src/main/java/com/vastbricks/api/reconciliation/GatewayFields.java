package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

/**
 * What the payment provider reports about the payment matched to the order. A payment mapper fills it in once it has
 * decided which order a payment settled, so every field is {@code null} until then and stays {@code null} on an
 * order no payment was matched to.
 *
 * <p>Two of its fields carry the same names as fields of {@link OrderFields}. That is deliberate and is the whole
 * point of grouping by source: the facilitator tax and the refund are each stated twice, once by the marketplace and
 * once by the provider, and a rule holding {@code order.refundedAmount} against {@code gateway.refundedAmount} is
 * comparing two accounts of one quantity rather than two quantities that happen to be alike.
 */
@Getter
@Setter
public class GatewayFields {

    /**
     * What the payment provider reports it took for this order, before its own fees, or {@code null} when no payment
     * was matched to the order. It is also what says a payment was matched at all, which is what the rules gate on.
     */
    private BigDecimal paidAmount;

    /**
     * What the payment provider reports the marketplace took out of the payment as tax facilitator, or {@code null}
     * when the payment states none or no payment was matched to the order.
     */
    private BigDecimal facilitatorTax;

    /**
     * What the payment provider reports has been refunded out of the payment, as a positive amount, or {@code null}
     * when it reports none and when no payment was matched to the order. A partial refund and a full one are the
     * same field: how much of the payment came back.
     *
     * <p>It is what the payment has been refunded to date rather than what was refunded within the reconciled
     * month, because it is read to say what the order may still be invoiced for, and an order refunded in November
     * is not invoiceable in August either.
     */
    private BigDecimal refundedAmount;

    /**
     * Where the payment provider shows the payment matched to this order, or {@code null} when there is no payment to
     * show or it cannot be addressed. The screen links the payment method to it.
     */
    private String paymentUrl;

    /**
     * The bank entries this order was settled by, each named by the bank's own reference, or empty for an order no
     * bank transfer was matched to.
     *
     * <p>It says which entries rather than how much, which the amounts above already say. The screen reads the bank
     * statement beside these orders and draws the link between the two, and an order matched by what a payer wrote
     * on the transfer is as linked as one a person mapped by hand — but only the mapping is written on the entry, so
     * without this the screen could show one kind of link and not the other.
     *
     * <p>Several because a buyer who underpaid and was asked for the rest made two transfers for one order, which is
     * the same reason the paid amount above is a sum.
     */
    private final List<String> entryReferences = new ArrayList<>();
}
