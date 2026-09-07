package com.vastbricks.api.stripeledger;

import com.stripe.model.BalanceTransaction;
import com.stripe.model.Charge;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Where a transaction can be looked at in Stripe's own interface, so a row the reader has questions about is one
 * click from the answer.
 *
 * <p>Only a transaction that settled a payment gets one. Stripe addresses a payment by the payment intent behind its
 * charge, falling back to the charge for a payment taken without one, and that address is the same one the
 * reconciliation screen already sends a reader to. A payout, a fee or a currency conversion is left without a link
 * rather than given a guessed one: a link that lands somewhere unrelated is worse than no link, and the transaction
 * id is in the row for a reader who wants to search Stripe for it.
 *
 * <p>The address is built here rather than in the portal because the account it has to be addressed under is
 * configured on this side. A link is not wording, so building it here does not put user-facing text in the backend.
 */
@Component
@RequiredArgsConstructor
class StripeLedgerLinks {

    private static final String PAYMENT = "https://dashboard.stripe.com/%s/payments/%s";

    private final StripeLedgerSettings settings;

    /**
     * Where Stripe shows the payment this transaction settled, or {@code null} when there is none to show or no
     * account configured to show it under — an account nobody stated would otherwise produce a link that lands
     * wherever the reader happens to be signed in.
     */
    String of(BalanceTransaction transaction) {
        var accountId = settings.getAccountId();
        var reference = paymentReference(transaction);
        if (reference == null || accountId == null || accountId.isBlank()) {
            return null;
        }
        return PAYMENT.formatted(accountId.trim(), reference);
    }

    private String paymentReference(BalanceTransaction transaction) {
        if (!(transaction.getSourceObject() instanceof Charge charge)) {
            return null;
        }
        return charge.getPaymentIntent() != null ? charge.getPaymentIntent() : charge.getId();
    }
}
