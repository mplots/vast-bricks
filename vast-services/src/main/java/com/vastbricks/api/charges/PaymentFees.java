package com.vastbricks.api.charges;

import java.math.BigDecimal;
import java.util.Set;

/**
 * What Stripe or PayPal charges this store for taking a payment, calculated from each provider's own published rate
 * rather than read off a payment: reconciliation's {@code gateway.feeAmount} is exactly the figure this exists to
 * check, not a substitute for working it out, and the orders screen holds no payment at all to read one from.
 *
 * <p>Takes the order's own payment method, grand total and country rather than a provider's record of a payment -
 * all three already collected onto every order, live or stored, the way {@code order.grandTotal} always is - so
 * unlike {@link MarketplaceFees} this needs no separate overload for a caller holding only a stored row.
 */
public final class PaymentFees {

    // Stripe's card rate for an EEA-issued card (stripe.com/pricing, Latvia pricing): 1.5% + EUR 0.25.
    private static final BigDecimal STRIPE_EEA_RATE = new BigDecimal("0.015");
    // Stripe's rate for a UK-issued card: 2.5% + EUR 0.25.
    private static final BigDecimal STRIPE_UK_RATE = new BigDecimal("0.025");
    // Stripe's rate for a card issued anywhere else: 3.15% + EUR 0.25.
    private static final BigDecimal STRIPE_INTERNATIONAL_RATE = new BigDecimal("0.0315");
    private static final BigDecimal STRIPE_FIXED_FEE = new BigDecimal("0.25");

    // PayPal's domestic commercial-transaction rate, EEA seller to EEA buyer
    // (paypal.com/ee/business/paypal-business-fees): 3.4%.
    private static final BigDecimal PAYPAL_EEA_RATE = new BigDecimal("0.034");
    // PayPal's rate for a UK buyer: the domestic 3.4% plus its published 1.29% cross-border surcharge.
    private static final BigDecimal PAYPAL_UK_RATE = new BigDecimal("0.0469");
    // PayPal's rate for a buyer anywhere else: the domestic 3.4% plus its published 1.99% cross-border surcharge.
    private static final BigDecimal PAYPAL_OTHER_RATE = new BigDecimal("0.0539");
    private static final BigDecimal PAYPAL_FIXED_FEE = new BigDecimal("0.35");

    /**
     * The European Economic Area: the EU's 27 members plus Iceland, Liechtenstein and Norway. The United Kingdom
     * left both and both providers price it as a tier of its own, so it is deliberately not here.
     */
    private static final Set<String> EEA = Set.of(
            "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT",
            "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO"
    );

    private PaymentFees() {
    }

    /**
     * Calculated from the grand total - the amount actually charged to the card or PayPal account - in whatever
     * currency it is stated in, which for {@code order.grandTotal} is the store's own base currency rather than what
     * the buyer paid in; neither provider's fixed fee is converted out of EUR to match, a gap this shares with
     * {@link MarketplaceFees} not converting currency either.
     *
     * <p>{@code country} tells the tier apart: this store is in the EEA, so a card or account issued anywhere else
     * costs more to take a payment from, and both providers price the United Kingdom as its own tier rather than
     * folding it into either side. A country this cannot place - {@code null}, or one nothing here recognizes as
     * EEA, UK, or otherwise - is priced as EEA, the same answer this returned before a country was collected at all:
     * an order this cannot classify is not evidence that it is foreign, and defaulting to the rate most of this
     * store's own orders are is closer than defaulting to the rate none of its domestic ones are.
     *
     * <p>Null for a payment method neither provider processes - a bank transfer, or the marketplace's own wording
     * for one {@link com.vastbricks.api.reconciliation.ReconciliationPaymentMethod} did not normalize to Stripe or
     * PayPal - there being no published rate to apply; and for an order with no grand total, there being no amount
     * to apply one to.
     */
    public static BigDecimal of(String paymentMethod, BigDecimal grandTotal, String country) {
        if (grandTotal == null) {
            return null;
        }
        return switch (paymentMethod == null ? "" : paymentMethod) {
            case "Stripe" -> grandTotal.multiply(stripeRate(country)).add(STRIPE_FIXED_FEE);
            case "PayPal" -> grandTotal.multiply(payPalRate(country)).add(PAYPAL_FIXED_FEE);
            default -> null;
        };
    }

    private static BigDecimal stripeRate(String country) {
        if ("GB".equals(country)) {
            return STRIPE_UK_RATE;
        }
        return isEea(country) ? STRIPE_EEA_RATE : STRIPE_INTERNATIONAL_RATE;
    }

    private static BigDecimal payPalRate(String country) {
        if ("GB".equals(country)) {
            return PAYPAL_UK_RATE;
        }
        return isEea(country) ? PAYPAL_EEA_RATE : PAYPAL_OTHER_RATE;
    }

    /** A country not placed at all defaults to the EEA rate, the same as one this does place there. */
    private static boolean isEea(String country) {
        return country == null || EEA.contains(country);
    }
}
