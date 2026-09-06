package com.vastbricks.api.reconciliation.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Where a payment can be looked at in the provider's own interface. The screen shows the link on the payment method,
 * so an order's payment is one click away from the row that failed to reconcile.
 *
 * <p>The address is built here rather than in the portal because it is the payment mappers that hold the provider's
 * reference for the payment they matched, and the Stripe account it has to be addressed under is configured on this
 * side. A link is not wording, so building it here does not put user-facing text in the backend.
 */
@Component
@RequiredArgsConstructor
class PaymentLinks {

    private static final String STRIPE_PAYMENT = "https://dashboard.stripe.com/%s/payments/%s";
    private static final String PAYPAL_TRANSACTION = "https://www.paypal.com/unifiedtransactions/details/payment/%s";

    private final PaymentLinkSettings settings;

    /**
     * Where Stripe shows this payment, or {@code null} when it cannot be addressed. Stripe needs the account as well
     * as the payment, so an account nobody configured leaves the order without a link rather than with one that
     * lands wherever the reader happens to be signed in.
     */
    String stripe(String paymentReference) {
        var accountId = settings.getStripeAccountId();
        if (paymentReference == null || accountId == null || accountId.isBlank()) {
            return null;
        }
        return STRIPE_PAYMENT.formatted(accountId.trim(), paymentReference);
    }

    /** Where PayPal shows this transaction, or {@code null} when the payment names none. */
    String payPal(String paymentReference) {
        return paymentReference == null ? null : PAYPAL_TRANSACTION.formatted(paymentReference);
    }
}
