package com.vastbricks.api.stripeledger;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/** Every response body of the Stripe transaction feature. */
public final class StripeLedgerPayload {

    private StripeLedgerPayload() {
    }

    @Getter
    @AllArgsConstructor
    public static final class TransactionsResponse {

        private final List<TransactionResponse> transactions;

        /** What the listed transactions came to, one group per currency, in the order the screen states them. */
        private final List<CurrencySummaryResponse> summary;
    }

    /**
     * A currency's account of the period: what went out, what came in, what Stripe took for taking it, and what the
     * balance moved by once all three are in.
     *
     * <p>One group per currency rather than one total, because an account moving in two currencies has two accounts
     * of itself and adding them would state a sum Stripe never stated. The fee line is what a Stripe ledger has and
     * a bank statement does not: a bank charges its fees as entries of their own, and Stripe deducts them from the
     * transaction they belong to.
     */
    @Getter
    @AllArgsConstructor
    public static final class CurrencySummaryResponse {

        private final String currency;

        /** Unsigned, the way a transaction's amount is: the direction is in the name rather than in the sign. */
        private final BigDecimal debitTurnover;

        private final BigDecimal creditTurnover;

        /**
         * What Stripe deducted across the period, signed as each fee was.
         *
         * <p>A memo of how much of the turnovers were fees rather than a term beside them: a fee is money that left
         * the account, so it is already counted in the turnover it moved. The PayPal ledger states its own the same
         * way, the two feet being read against each other.
         */
        private final BigDecimal fees;

        /**
         * What the balance moved by over the period: credits less debits less fees, and therefore signed.
         *
         * <p>It is the sum of the transactions' own net amounts rather than a figure Stripe stated for the period,
         * and the two turnovers come to it on their own, the fees being inside them rather than subtracted after.
         * It answers what the period did; the balance below answers where the account stood when it ended, and
         * every ledger screen states both so the three can be read against each other.
         */
        private final BigDecimal netMovement;

        /**
         * Where the account stood at the end of the period, or {@code null} where it could not be established.
         *
         * <p>Stripe answers for the balance at this moment and for no other, so this is worked back from the one it
         * does state: what the account holds now, less everything it has moved since the period ended. A period
         * still running has moved nothing since, so its closing balance is simply what Stripe holds today, which is
         * the only true answer there is for it.
         *
         * <p>Working back over a period long gone means reading every transaction since, which is the same live
         * aggregation this screen already accepts. Where that cannot be done — Stripe refusing, or more pages than
         * the client will walk — the balance is left unstated rather than guessed, and the foot omits the line.
         */
        private final BigDecimal closingBalance;
    }

    /** One balance transaction of the account, as Stripe reported it. */
    @Getter
    @Builder
    public static final class TransactionResponse {

        /** Stripe's own id for the transaction, which is what the ledger is keyed by. */
        private final String id;

        /** When Stripe dated it, in UTC, which is the instant the period is read against. */
        private final Instant created;

        /** What Stripe says the transaction is: {@code charge}, {@code refund}, {@code payout}, {@code stripe_fee}. */
        private final String type;

        /** Whatever Stripe carried on the transaction, which for a payment is what the marketplace labelled it. */
        private final String description;

        /** Unsigned; {@code direction} says which way the balance moved. */
        private final BigDecimal amount;

        private final StripeLedgerDirection direction;

        /**
         * What Stripe deducted from this transaction, signed as a deduction, or {@code null} where it deducted
         * nothing. Stripe states a fee the other way up from PayPal, so it is negated here and the two ledgers state
         * a fee alike.
         */
        private final BigDecimal fee;

        /** What the transaction left in the balance: the amount with the fee added in, signed as the amount was. */
        private final BigDecimal net;

        private final String currency;

        /** {@code available} or {@code pending}, as Stripe states it. */
        private final String status;

        /** What the transaction was raised against — the charge, refund or payout it belongs to. */
        private final String sourceId;

        /** Where Stripe shows it, or {@code null} when it has no page a reader can be sent to. */
        private final String link;
    }
}
