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
     * the whole of what is left, and one with no grand total has no target to invoice for.
     *
     * <p>A refund reaching past what was the store's to invoice leaves nothing to invoice rather than a negative
     * invoice. The two subtractions are not taken out of the same pocket: the marketplace keeps the facilitator tax
     * it took whether or not the buyer was refunded, so a fully refunded order it collected tax on would otherwise
     * be invoiced for less than nothing, and no invoice can be written for that.
     */
    private final BigDecimal targetInvoice;
}
