package com.vastbricks.api.paypalledger;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

/** Every response body of the PayPal transaction feature. */
public final class PayPalLedgerPayload {

    private PayPalLedgerPayload() {
    }

    @Getter
    @AllArgsConstructor
    public static final class TransactionsResponse {

        private final List<TransactionResponse> transactions;

        /** What the listed transactions came to, one group per currency, in the order the screen states them. */
        private final List<CurrencySummaryResponse> summary;
    }

    /**
     * A currency's account of the period: what went out, what came in, what was deducted from it, and what the
     * balance moved by once all three are in.
     *
     * <p>One group per currency rather than one total, because an account moving in two currencies has two accounts
     * of itself and adding them would state a sum PayPal never stated.
     */
    @Getter
    @AllArgsConstructor
    public static final class CurrencySummaryResponse {

        private final String currency;

        /** Unsigned, the way a transaction's amount is: the direction is in the name rather than in the sign. */
        private final BigDecimal debitTurnover;

        private final BigDecimal creditTurnover;

        /**
         * What was deducted across the period, signed as each deduction was — PayPal's own charges and what the
         * marketplaces took as partner alike.
         *
         * <p>One figure and not two. What a transaction cost is one line in the table, and which party took which
         * part of it is a detail of that transaction, stated where the rest of its account is; a foot is read for
         * what a period came to, not for how its costs were shared out.
         *
         * <p>A memo of how much of the turnovers were fees rather than a term beside them: a deduction is money
         * that left the account, so it is already counted in the turnover it moved. The Stripe ledger states its own
         * the same way, the two feet being read against each other.
         */
        private final BigDecimal fees;

        /**
         * Where the account stood at the end of the period, or {@code null} where PayPal did not say.
         *
         * <p>PayPal's own figure rather than one worked out: unlike Stripe, it answers for the balance at a stated
         * moment, so a period's closing balance is simply what PayPal held when it ended. A period still running is
         * asked about as of now, which is the only true answer there is for it.
         *
         * <p>Everything the account holds in the currency, what is withheld against a dispute included: what the
         * account stood at is everything in it, not only the part that could have been spent that day.
         */
        private final BigDecimal closingBalance;

        /**
         * What the balance moved by over the period: credits less debits, and therefore signed.
         *
         * <p>The deductions are inside those turnovers rather than subtracted after them, so the two lines above
         * this one come to it on their own. It answers what the period did; the balance answers where the account
         * stood when it ended, and every ledger screen states both so the three can be read against each other.
         *
         * <p>It is summed from the transactions listed rather than asked of PayPal, so it is the movement the period
         * holds and not a closing balance. PayPal knows the account's balance and this screen does not ask for it: a
         * balance is a fact about now, and the period being read is normally not now.
         */
        private final BigDecimal netMovement;
    }

    /**
     * One transaction of the account: the thing PayPal did, as PayPal's own interface shows it.
     *
     * <p>PayPal reports what a reader thinks of as one payment as several balance-affecting records — the payment,
     * the commission the marketplace took as partner, the conversions into the balance's currency — and shows them
     * under one transaction. So does this: the record that was raised against nothing is the transaction, and
     * everything raised against it is either folded into its figures or carried as one of its {@link #lines}. None
     * of them is a transaction of the period in its own right, so none of them reaches the list or the summary.
     */
    @Getter
    @Builder
    public static final class TransactionResponse {

        /** PayPal's own id for the transaction, which is what the ledger is keyed by. */
        private final String id;

        /**
         * PayPal's own event code for what happened: {@code T0006} for a payment received, {@code T1107} for a
         * refund, {@code T0400} for a withdrawal to the bank.
         *
         * <p>It is the code and not a word, because a code is all PayPal states. The portal words the ones a
         * merchant account meets and shows the code itself for the rest, so a product PayPal adds tomorrow reads as
         * its code rather than as nothing at all.
         */
        private final String type;

        /** When PayPal dated it, in UTC, which is the instant the period is read against. */
        private final Instant created;

        /** What PayPal carried on the transaction as its subject, where it carried one. */
        private final String description;

        /** What the marketplace labelled the payment with. BrickOwl puts its bare order number here. */
        private final String invoiceId;

        /** Who the money moved to or from, as PayPal spells them: the payer's name, or the shipping recipient. */
        private final String counterparty;

        /** The account the payer paid from, which is the second thing the counterparty column states. */
        private final String counterpartyEmail;

        /** Unsigned; {@code direction} says which way the balance moved. */
        private final BigDecimal amount;

        private final PayPalLedgerDirection direction;

        /**
         * Everything deducted from the transaction, signed as PayPal signed it, or {@code null} where nothing was.
         *
         * <p>It is the whole deduction rather than PayPal's own processing fee alone: the commission the marketplace
         * took as partner is money out of this transaction just as the fee is, and a reader of the ledger wants one
         * figure for what the transaction cost. What it was made of is {@link #payPalFee} and
         * {@link #partnerCommission}, which the detail view lays out the way PayPal's own panel does.
         *
         * <p>Signed rather than stated as a magnitude the way the Stripe ledger states one, because PayPal reports a
         * deduction as an amount of its own: it is normally negative, but a refunded payment returns part of the
         * fee, and a magnitude in a column always read as a deduction could not say that.
         */
        private final BigDecimal fee;

        /** What the transaction left in the balance: the amount with everything deducted from it added in. */
        private final BigDecimal net;

        private final String currency;

        /** PayPal's own status letter: {@code S} settled, {@code P} pending, {@code V} reversed, {@code D} denied. */
        private final String status;

        /** What the transaction was raised against, where PayPal named something: normally the checkout it came from. */
        private final String sourceId;

        /** Where PayPal shows it. */
        private final String link;

        /**
         * What the gross amount was made up of, and what was taken off it, as PayPal's own transaction details panel
         * lists them. Every field is {@code null} where PayPal stated none.
         */
        private final BreakdownResponse breakdown;

        /**
         * The other records PayPal raised against this transaction, in the order they read: the partner commission
         * folded into the fee above, and the conversions that moved what was left into another currency.
         *
         * <p>They are carried here rather than listed in the period because they are not transactions of the account
         * — they are what this one transaction was made of, which is exactly how PayPal shows them.
         */
        private final List<LineResponse> lines;
    }

    /**
     * PayPal's own account of what the transaction came to, top to bottom.
     *
     * <p>The purchase total is the only derived figure: PayPal states what it added to the purchase rather than the
     * purchase itself, so what is left of the gross once those are taken off is what was bought. Its own panel shows
     * the same line, arrived at the same way.
     */
    @Getter
    @Builder
    public static final class BreakdownResponse {

        /**
         * The currency PayPal stated the transaction itself in, which is not necessarily the one the transaction is
         * stated in: a converted transaction is stated in the currency it was converted into, while this panel stays
         * in PayPal's own terms, as PayPal's own page does.
         */
        private final String currency;

        private final BigDecimal purchaseTotal;
        private final BigDecimal salesTax;
        private final BigDecimal shipping;
        private final BigDecimal handling;
        private final BigDecimal insurance;
        private final BigDecimal discount;
        private final BigDecimal shippingDiscount;

        /** PayPal's own processing fee, signed as PayPal signed it. */
        private final BigDecimal payPalFee;

        /** What the marketplace took as partner, signed as PayPal signed it, summed over the records stating it. */
        private final BigDecimal partnerCommission;

        /** What PayPal charged for a dispute on the transaction, signed as PayPal signed it. */
        private final BigDecimal disputeFee;

        /** What PayPal stated the transaction moved, signed, this panel being an account rather than a column. */
        private final BigDecimal gross;

        /** What PayPal's own account of the transaction ends on: the gross with everything above taken off. */
        private final BigDecimal net;

        /**
         * What the conversion took back out of PayPal's own currency, or {@code null} where PayPal converted
         * nothing.
         *
         * <p>It is what carries the account over into the currency the transaction is stated in, so the panel does
         * not stop at a net in a currency the account never held: the line after it is the transaction's own net,
         * in the currency it was converted into.
         */
        private final BigDecimal conversion;
    }

    /** One record PayPal raised against a transaction. */
    @Getter
    @Builder
    public static final class LineResponse {

        /**
         * Whether the amount details already state this record — a deduction they name, or a leg of the conversion
         * they end on.
         *
         * <p>Nearly every record PayPal raises is one of those, so listing them again beside the account they are
         * already in would be saying the same thing twice. What this is for is the one PayPal raises that the
         * account has no line for: it is still reported, so it can still be read.
         */
        private final boolean accountedFor;

        private final String id;
        private final Instant created;

        /** PayPal's event code: {@code T0113} for the partner commission, {@code T0200} for a conversion. */
        private final String type;

        /** Signed as PayPal stated it, this being a line of an account rather than a column of a table. */
        private final BigDecimal amount;

        private final String currency;
        private final String status;
        private final String link;
    }
}
