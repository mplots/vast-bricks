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

        /** What Stripe deducted across the period, unsigned, the marketplace's application fees included. */
        private final BigDecimal fees;

        /**
         * What the balance moved by over the period: credits less debits less fees, and therefore signed.
         *
         * <p>It is the sum of the transactions' own net amounts rather than a figure Stripe stated for the period,
         * so it is the movement the period holds and not a closing balance. Stripe knows the account's balance and
         * this screen does not ask for it: a balance is a fact about now, and the period being read is normally not
         * now.
         */
        private final BigDecimal net;
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

        /** What Stripe deducted from this transaction, unsigned, or {@code null} where it deducted nothing. */
        private final BigDecimal fee;

        /** What the transaction left in the balance: the amount less the fee, signed as the amount was. */
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
