package com.vastbricks.api.charges;

import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import java.math.BigDecimal;

/**
 * What a marketplace's own published commission on an order comes to, calculated from its rate schedule rather than
 * read off the order: BrickLink states no per-order fee anywhere its export or API record reaches, and BrickOwl's own
 * reported {@code brickowl_fee} is exactly the figure this exists to check, not a substitute for working it out.
 *
 * <p>One {@code of} overload per marketplace order, exactly as {@link OrderTaxTypes} and {@link FacilitatorTaxes} are
 * shaped: a caller passes the marketplace order it already holds and gets an amount back, in whatever the order
 * states its own amounts in. Adding a marketplace is one more overload; callers do not change.
 */
public final class MarketplaceFees {

    // BrickLink's tiered commission (bricklink.com/help.asp?helpID=38): 3% of the first $500 of an order, 2% of the
    // next $500, 1% of anything past $1,000 - applied per order, to "the final dollar amount... that a seller
    // receives," which is read here as the grand total, items and shipping together.
    private static final BigDecimal BRICK_LINK_TIER_1_CEILING = new BigDecimal("500");
    private static final BigDecimal BRICK_LINK_TIER_2_CEILING = new BigDecimal("1000");
    private static final BigDecimal BRICK_LINK_TIER_1_RATE = new BigDecimal("0.03");
    private static final BigDecimal BRICK_LINK_TIER_2_RATE = new BigDecimal("0.02");
    private static final BigDecimal BRICK_LINK_TIER_3_RATE = new BigDecimal("0.01");

    // BrickOwl's flat commission (brickowl.com/help/store-fees): 2.65% of "the order total minus shipping minus
    // non-import taxes."
    private static final BigDecimal BRICK_OWL_RATE = new BigDecimal("0.0265");

    private MarketplaceFees() {
    }

    /**
     * BrickLink's tiered commission on the order's grand total, {@code BASEGRANDTOTAL} — the one field either
     * marketplace states as a full items-and-shipping total, which is why {@code order.grandTotal} is already read
     * from it elsewhere. A VAT-registered store is billed on its net-of-VAT amount instead, per the same help page;
     * this does not subtract {@code VATCHARGES}, which is the gap between this figure and BrickLink's own bill for
     * such a store.
     *
     * <p>Null where the order states no grand total, there being no amount to apply a rate to.
     */
    public static BigDecimal of(BrickStoreOrder order) {
        BigDecimal grandTotal = order == null ? null : order.getBaseGrandTotal();
        return grandTotal == null ? null : tiered(grandTotal);
    }

    /**
     * BrickLink's tiered commission applied to a grand total already at hand, for a caller holding a stored amount
     * rather than BrickLink's own order — the orders screen's stored {@code grandTotal}, which is
     * {@code BASEGRANDTOTAL} verbatim, so there is no approximation in calculating from it here instead of from
     * {@link #of(BrickStoreOrder)}'s own order.
     */
    public static BigDecimal brickLinkOf(BigDecimal grandTotal) {
        return grandTotal == null ? null : tiered(grandTotal);
    }

    private static BigDecimal tiered(BigDecimal amount) {
        if (amount.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        BigDecimal firstTier = amount.min(BRICK_LINK_TIER_1_CEILING);
        BigDecimal secondTier = amount.min(BRICK_LINK_TIER_2_CEILING).subtract(firstTier).max(BigDecimal.ZERO);
        BigDecimal thirdTier = amount.subtract(BRICK_LINK_TIER_2_CEILING).max(BigDecimal.ZERO);
        return firstTier.multiply(BRICK_LINK_TIER_1_RATE)
                .add(secondTier.multiply(BRICK_LINK_TIER_2_RATE))
                .add(thirdTier.multiply(BRICK_LINK_TIER_3_RATE));
    }

    /**
     * BrickOwl's flat commission, calculated independently of the {@code brickowl_fee} it reports on the same order
     * rather than reading that field, which is what lets the two be checked against each other instead of one
     * silently standing in for the other.
     *
     * <p>"Non-import" tax is what {@link OrderTaxTypes} already tells apart from the rest of what {@code tax_amount}
     * states: the facilitator tax BrickOwl collects on an {@link OrderTaxType#EXPORT_TAXABLE} order is import-related
     * and stays in the base, where the VAT a {@link OrderTaxType#DOMESTIC} or {@link OrderTaxType#EUROPEAN_UNION}
     * order carries under the store's own registration is not and is subtracted alongside shipping.
     *
     * <p>Null where the order states no order total, there being no amount to apply a rate to.
     */
    public static BigDecimal of(BrickOwlOrder order) {
        BigDecimal total = order == null ? null : order.getBaseOrderTotal();
        if (total == null) {
            return null;
        }
        BigDecimal base = total.subtract(zeroIfAbsent(order.getShipping())).subtract(nonImportTax(order));
        return base.max(BigDecimal.ZERO).multiply(BRICK_OWL_RATE);
    }

    /**
     * BrickOwl's flat commission applied to a stored order total and shipping rather than to its own order: a stored
     * order keeps no tax scheme or raw tax amount to tell an import tax apart from VAT charged under the store's own
     * registration, so neither is subtracted here. An order taxed under its own registration therefore reads a
     * slightly higher fee here than {@link #of(BrickOwlOrder)} calculates from the live order — the gap between the
     * two figures for such an order, and the reason a screen holding only stored amounts approximates rather than
     * matches reconciliation's own live calculation.
     */
    public static BigDecimal brickOwlOf(BigDecimal orderTotal, BigDecimal shipping) {
        if (orderTotal == null) {
            return null;
        }
        BigDecimal base = orderTotal.subtract(zeroIfAbsent(shipping));
        return base.max(BigDecimal.ZERO).multiply(BRICK_OWL_RATE);
    }

    private static BigDecimal nonImportTax(BrickOwlOrder order) {
        OrderTaxType taxType = OrderTaxTypes.of(order);
        boolean nonImport = taxType == OrderTaxType.DOMESTIC || taxType == OrderTaxType.EUROPEAN_UNION;
        return nonImport ? zeroIfAbsent(order.getTaxAmount()) : BigDecimal.ZERO;
    }

    /** A charge the marketplace did not report is a charge of nothing, as it is when the tax type is derived. */
    private static BigDecimal zeroIfAbsent(BigDecimal amount) {
        return amount == null ? BigDecimal.ZERO : amount;
    }
}
