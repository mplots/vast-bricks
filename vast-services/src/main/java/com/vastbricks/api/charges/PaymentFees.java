package com.vastbricks.api.charges;

import java.math.BigDecimal;

/**
 * What Stripe or PayPal charges this store for taking a payment, calculated from each provider's own published rate
 * rather than read off a payment: reconciliation's {@code gateway.feeAmount} is exactly the figure this exists to
 * check, not a substitute for working it out, and the orders screen holds no payment at all to read one from.
 *
 * <p>Takes the order's own payment method and grand total rather than a provider's record of a payment - both
 * already collected onto every order, live or stored, the way {@code order.grandTotal} always is - so unlike
 * {@link MarketplaceFees} this needs no separate overload for a caller holding only a stored row.
 */
public final class PaymentFees {

    // Stripe's card rate for EEA-issued cards (stripe.com/pricing, Latvia pricing): 1.5% + EUR 0.25 per transaction.
    private static final BigDecimal STRIPE_RATE = new BigDecimal("0.015");
    private static final BigDecimal STRIPE_FIXED_FEE = new BigDecimal("0.25");

    // PayPal's domestic commercial-transaction rate for EEA sellers and buyers
    // (paypal.com/ee/business/paypal-business-fees): 3.4% + EUR 0.35 per transaction. The page also adds a
    // cross-border surcharge for a buyer outside the EEA, which this does not have enough to tell apart and does
    // not add.
    private static final BigDecimal PAYPAL_RATE = new BigDecimal("0.034");
    private static final BigDecimal PAYPAL_FIXED_FEE = new BigDecimal("0.35");

    private PaymentFees() {
    }

    /**
     * Calculated from the grand total - the amount actually charged to the card or PayPal account - in whatever
     * currency it is stated in, which for {@code order.grandTotal} is the store's own base currency rather than what
     * the buyer paid in; neither provider's fixed fee is converted out of EUR to match, exactly the kind of gap
     * {@link MarketplaceFees} already carries for not converting currency either.
     *
     * <p>Null for a payment method neither provider processes - a bank transfer, or the marketplace's own wording
     * for one {@link com.vastbricks.api.reconciliation.ReconciliationPaymentMethod} did not normalize to Stripe or
     * PayPal - there being no published rate to apply; and for an order with no grand total, there being no amount
     * to apply one to.
     */
    public static BigDecimal of(String paymentMethod, BigDecimal grandTotal) {
        if (grandTotal == null) {
            return null;
        }
        return switch (paymentMethod == null ? "" : paymentMethod) {
            case "Stripe" -> grandTotal.multiply(STRIPE_RATE).add(STRIPE_FIXED_FEE);
            case "PayPal" -> grandTotal.multiply(PAYPAL_RATE).add(PAYPAL_FIXED_FEE);
            default -> null;
        };
    }
}
