package com.vastbricks.api.paypalledger;

import org.springframework.stereotype.Component;

/**
 * Where a transaction can be looked at in PayPal's own interface, so a row the reader has questions about is one
 * click from the answer.
 *
 * <p>PayPal addresses a transaction by its id alone, which is the whole difference from the Stripe ledger's links:
 * there is no account to configure, and every transaction PayPal reported has a page, so a row is never left without
 * a link for want of a setting. It is the same address the reconciliation screen already sends a reader to.
 *
 * <p>The address is built here rather than in the portal for the reason it is on the Stripe screen: a link is not
 * wording, so building it in the backend does not put user-facing text there.
 */
@Component
class PayPalLedgerLinks {

    private static final String TRANSACTION = "https://www.paypal.com/unifiedtransactions/details/payment/%s";

    /** Where PayPal shows this transaction, or {@code null} when it named no id to address it by. */
    String of(String transactionId) {
        if (transactionId == null || transactionId.isBlank()) {
            return null;
        }
        return TRANSACTION.formatted(transactionId.trim());
    }
}
