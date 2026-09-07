package com.vastbricks.api.stripeledger;

/**
 * Which way a transaction moved the Stripe balance.
 *
 * <p>Stripe signs the amount itself, but the screen reads a ledger the way it reads a bank statement: the amount is
 * reported unsigned and the direction says which way it went, so a column of figures lines up and one field carries
 * one fact.
 */
public enum StripeLedgerDirection {

    CREDIT,
    DEBIT;

    /** Which way an amount in Stripe's own minor units moved the balance. Nothing moved reads as money in. */
    static StripeLedgerDirection of(Long amount) {
        return amount == null || amount >= 0 ? CREDIT : DEBIT;
    }
}
