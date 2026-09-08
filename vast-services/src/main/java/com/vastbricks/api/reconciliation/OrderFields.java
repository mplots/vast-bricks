package com.vastbricks.api.reconciliation;

import com.vastbricks.api.tax.OrderTaxType;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * What the marketplace reported about the order itself: the account every other source is reconciled against. An
 * order mapper builds it whole; the one field a detail mapper fills in afterwards is the buyer username, which
 * BrickLink reports in an export of its own.
 *
 * <p>The field order is the order the API exposes them in, and it is the order the roster declares them in.
 */
@Getter
@Setter
@Builder
public class OrderFields {

    private String source;
    private String orderId;

    /**
     * Where the marketplace shows this order, or {@code null} when it was collected without an id to address. The
     * screen links the order id to it, as it links the payment method to the payment.
     */
    private String orderUrl;
    private LocalDate orderDate;
    private String buyer;
    private String buyerUsername;

    /**
     * How the order was paid: one name per payment provider, or the marketplace's own wording for a method no
     * provider is known for.
     */
    private String paymentMethod;

    /** How the order is treated for tax, derived from what the marketplace reported. */
    private OrderTaxType taxType;

    /**
     * What the marketplace collected on the order as tax facilitator, under its own registration, or {@code null}
     * when it collected none.
     */
    private BigDecimal facilitatorTax;

    private BigDecimal subTotal;

    /**
     * What the marketplace charged the buyer for shipping the order — BrickOwl's {@code ship_total} and BrickLink's
     * {@code ORDERSHIPPING} — or {@code null} where it charged none.
     *
     * <p>It is the buyer's side of the postage, which {@link ShipmentFields#getTotalAmount()} states from the post
     * office's: one is what the order collected for shipping and the other is what shipping it cost. Nothing compares
     * them yet.
     *
     * <p>Stated as the marketplace stated it, in the currency it stated it in, as the sub-total above is: no order
     * carries a currency, and the grand total is the one amount either marketplace gives in the store's base
     * currency.
     */
    private BigDecimal shippingCost;

    /** What the order came to in the store's base currency, shipping and additional charges included. */
    private BigDecimal grandTotal;

    /**
     * What the marketplace reports was refunded to the buyer on this order, as a positive amount, or {@code null}
     * when it reports none. It is the marketplace's own account of the refund that
     * {@link GatewayFields#getRefundedAmount()} states from the payment's side; the two carry one name under two
     * sources, which is what makes them the two accounts of one refund rather than two amounts.
     *
     * <p>BrickOwl states a refund total on the order itself. BrickLink states it only on the order detail page, so it
     * is collected for the orders the export reports as cancelled and for no others. Where it is uncollected the rule
     * that compares the two sides fails wherever the payment shows a refund, which is the intended reading: an order
     * the money came back out of that the marketplace does not say came back is exactly the disagreement worth
     * seeing.
     */
    private BigDecimal refundedAmount;
}
