package com.vastbricks.api.reconciliation;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * What reconciliation derives from the collected sources rather than any of them stating it. It is computed when the
 * order is read rather than stored, so it can never disagree with the fields it is derived from.
 */
@Getter
@AllArgsConstructor
public class CalculatedFields {

    /**
     * What the accounting invoice for this order has to come to: the grand total less what the marketplace collected
     * as tax facilitator, because that tax was charged under the marketplace's registration and is not the store's to
     * invoice, and less what has since been refunded to the buyer, which the store no longer holds to invoice for.
     *
     * <p>The refund it subtracts is the payment provider's, not the marketplace's: what may still be invoiced turns
     * on money having actually gone back, and the provider is the side that moved it. The marketplace's own account
     * of the refund is collected to be compared against that one, not to be calculated from.
     *
     * <p>An order no facilitator collected on is invoiced for its whole grand total, one nothing was refunded on for
     * the whole of what is left, and one with no grand total has no target to invoice for. Neither has an order the
     * marketplace says was refunded in full and that no payment was matched to: with no payment collected there is
     * no account of the money the refund could be taken out of, so the order has no target at all rather than a
     * target of nothing.
     *
     * <p>A refund reaching past what was the store's to invoice leaves nothing to invoice rather than a negative
     * invoice. The two subtractions are not taken out of the same pocket: the marketplace keeps the facilitator tax
     * it took whether or not the buyer was refunded, so a fully refunded order it collected tax on would otherwise
     * be invoiced for less than nothing, and no invoice can be written for that.
     */
    private final BigDecimal targetInvoice;

    /**
     * What this store calculates the marketplace's own commission on the order as, from
     * {@link com.vastbricks.api.charges.MarketplaceFees} rather than from any figure either marketplace
     * states: BrickLink states no such figure at all, and BrickOwl's own reported one,
     * {@link OrderFields#getMarketplaceFee()}, is what this is for checking against, not reading in place of
     * calculating. Computed from the marketplace's own order at mapping time, the one point a live order is at hand,
     * rather than here from the fields already collected — the same reason the tax type and facilitator tax above it
     * are derived where they are rather than recomputed on every read.
     */
    private final BigDecimal marketplaceFee;

    /**
     * What this store calculates Stripe's or PayPal's own charge for taking the payment as, from
     * {@link com.vastbricks.api.charges.PaymentFees} rather than from any figure a payment states: the gateway's own
     * reported fee, {@link GatewayFields#getFeeAmount()}, is what this is for checking against, not reading in place
     * of calculating. Unlike the marketplace fee beside it, this needs nothing a mapper alone holds - only the
     * payment method and grand total already collected onto {@link OrderFields} - so it is worked out here, on every
     * read, exactly as the target invoice is.
     */
    private final BigDecimal paymentFee;
}
