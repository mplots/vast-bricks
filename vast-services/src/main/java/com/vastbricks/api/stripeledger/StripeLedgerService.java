package com.vastbricks.api.stripeledger;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.client.stripe.StripeBalanceClient;
import com.vastbricks.api.stripeledger.StripeLedgerPayload.CurrencySummaryResponse;
import com.vastbricks.api.stripeledger.StripeLedgerPayload.TransactionResponse;
import com.vastbricks.api.stripeledger.StripeLedgerPayload.TransactionsResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The Stripe ledger of one period, and what it came to.
 *
 * <p>Read live from Stripe every time the screen is opened, and stored nowhere. Stripe is the record here, exactly as
 * the marketplaces and the payment providers are the record for reconciliation; the bank statement screen stores its
 * entries only because no provider exposes the account, which is not the case for a Stripe balance.
 *
 * <p>Every balance transaction of the period is listed rather than only the ones that paid for an order. The screen
 * is the account's own ledger — the charges, the refunds, the fees Stripe took, the payouts to the bank and the
 * currency conversions between them — which is what makes it readable against a bank statement in the first place.
 * Deciding which of them pays for an order is reconciliation's business and stays there.
 */
@Service
@RequiredArgsConstructor
class StripeLedgerService {

    /** Stripe reports money in the currency's minor units, so an amount is two decimal places to the left of it. */
    private static final int MINOR_UNIT_SCALE = 2;

    private final StripeBalanceClient stripeBalanceClient;
    private final StripeLedgerLinks links;

    TransactionsResponse transactionsOf(StripeLedgerPeriod period) {
        var transactions = stripeBalanceClient.listBalanceTransactions(period.getFrom(), period.getTo())
                .stream()
                // Oldest first, the way a ledger is read and the way the bank statement screen lists a period: the
                // order the account moved in is the order the movement makes sense in. A transaction Stripe dated
                // nothing sorts last rather than first, and transactions sharing an instant keep the order Stripe
                // listed them in.
                .sorted(Comparator.comparing(
                        StripeLedgerService::createdAt,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(this::transaction)
                .toList();

        return new TransactionsResponse(transactions, summaryOf(transactions));
    }

    private TransactionResponse transaction(BalanceTransaction transaction) {
        var amount = amount(transaction.getAmount());
        return TransactionResponse.builder()
                .id(transaction.getId())
                .created(createdAt(transaction))
                .type(transaction.getType())
                .description(description(transaction))
                // Unsigned, the way a bank states an entry's amount: which way the balance moved is the direction
                // beside it rather than a minus sign the column has to be read for.
                .amount(amount == null ? null : amount.abs())
                .direction(StripeLedgerDirection.of(transaction.getAmount()))
                .fee(fee(transaction))
                .net(amount(transaction.getNet()))
                .currency(currency(transaction.getCurrency()))
                .status(transaction.getStatus())
                .sourceId(transaction.getSource())
                .link(links.of(transaction))
                .build();
    }

    /**
     * What Stripe deducted from the transaction, or {@code null} where it deducted nothing.
     *
     * <p>Stripe states a fee of nothing as a zero, and a fee column reading {@code 0.00} down every payout and
     * refund says nothing a reader needs: Stripe takes its fee out of the transaction it belongs to rather than out
     * of all of them. So nothing deducted is reported as no fee, and the transaction's net still states the whole
     * of what it left behind.
     */
    private BigDecimal fee(BalanceTransaction transaction) {
        if (transaction.getFee() == null || transaction.getFee() == 0L) {
            return null;
        }
        return amount(transaction.getFee()).abs();
    }

    private static Instant createdAt(BalanceTransaction transaction) {
        return transaction.getCreated() == null ? null : Instant.ofEpochSecond(transaction.getCreated());
    }

    private static String description(BalanceTransaction transaction) {
        if (transaction.getDescription() == null || transaction.getDescription().isBlank()) {
            return null;
        }
        return transaction.getDescription().trim();
    }

    /** Stripe names a currency in lower case; it is shown beside amounts, where a currency is written in upper. */
    private static String currency(String currency) {
        return currency == null || currency.isBlank() ? null : currency.trim().toUpperCase();
    }

    private static BigDecimal amount(Long minorUnits) {
        if (minorUnits == null) {
            return null;
        }
        return BigDecimal.valueOf(minorUnits).movePointLeft(MINOR_UNIT_SCALE).setScale(MINOR_UNIT_SCALE, RoundingMode.HALF_UP);
    }

    /**
     * What the period came to, one group per currency the account moved in and in currency order, so the foot of the
     * table reads the same way whichever period is asked for.
     *
     * <p>It is summed from the transactions listed rather than asked of Stripe: the four figures are the four
     * questions the ledger above answers, and a period Stripe would state a balance for is normally not the period
     * being read.
     */
    private static List<CurrencySummaryResponse> summaryOf(List<TransactionResponse> transactions) {
        Map<String, Totals> byCurrency = new TreeMap<>(Comparator.nullsLast(Comparator.naturalOrder()));
        for (var transaction : transactions) {
            byCurrency.computeIfAbsent(transaction.getCurrency(), currency -> new Totals()).add(transaction);
        }

        return byCurrency.entrySet().stream()
                .map(entry -> new CurrencySummaryResponse(
                        entry.getKey(),
                        entry.getValue().debitTurnover,
                        entry.getValue().creditTurnover,
                        entry.getValue().fees,
                        entry.getValue().net
                ))
                .toList();
    }

    /** One currency's running totals while the period is being summed. */
    private static final class Totals {

        private BigDecimal debitTurnover = zero();
        private BigDecimal creditTurnover = zero();
        private BigDecimal fees = zero();
        private BigDecimal net = zero();

        private void add(TransactionResponse transaction) {
            if (transaction.getAmount() != null) {
                if (transaction.getDirection() == StripeLedgerDirection.DEBIT) {
                    debitTurnover = debitTurnover.add(transaction.getAmount());
                } else {
                    creditTurnover = creditTurnover.add(transaction.getAmount());
                }
            }
            if (transaction.getFee() != null) {
                fees = fees.add(transaction.getFee());
            }
            if (transaction.getNet() != null) {
                net = net.add(transaction.getNet());
            }
        }

        private static BigDecimal zero() {
            return BigDecimal.ZERO.setScale(MINOR_UNIT_SCALE);
        }
    }
}
