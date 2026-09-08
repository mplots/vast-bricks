package com.vastbricks.api.paypalledger;

import java.math.BigDecimal;

/**
 * Which way a transaction moved the PayPal balance.
 *
 * <p>PayPal signs the amount itself, but the screen reads a ledger the way it reads a bank statement: the amount is
 * reported unsigned and the direction says which way it went, so a column of figures lines up and one field carries
 * one fact.
 */
public enum PayPalLedgerDirection {

    CREDIT,
    DEBIT;

    /** Which way an amount PayPal stated moved the balance. Nothing moved reads as money in. */
    static PayPalLedgerDirection of(BigDecimal amount) {
        return amount == null || amount.signum() >= 0 ? CREDIT : DEBIT;
    }
}
