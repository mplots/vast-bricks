package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.bankstatement.BankTransfer;
import com.vastbricks.api.bankstatement.BankStatementDirection;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import java.util.function.Predicate;

/**
 * What a bank entry means to reconciliation, kept beside the mapper that decides which order it settled the way
 * {@link StripePayments} and {@link PayPalPayments} sit beside theirs.
 */
final class BankPayments {

    /** The payment method a bank transfer collects as, as the mapping unified the marketplaces' wording. */
    static final String BANK_TRANSFER = "Bank Transfer";

    /**
     * Orders the marketplace says were settled by bank transfer. A bank entry names an order in free text a payer
     * wrote, so it is only ever read against orders that were actually paid this way.
     */
    static final Predicate<ReconciledOrder> PAID_BY_BANK_TRANSFER =
            order -> BANK_TRANSFER.equals(order.getOrder().getPaymentMethod());

    private BankPayments() {
    }

    /** Whether this entry is money the store received. */
    static boolean isCredit(BankTransfer transfer) {
        return transfer.getDirection() == BankStatementDirection.CREDIT;
    }

    /** Whether this entry is money the store sent back out. */
    static boolean isDebit(BankTransfer transfer) {
        return transfer.getDirection() == BankStatementDirection.DEBIT;
    }
}
