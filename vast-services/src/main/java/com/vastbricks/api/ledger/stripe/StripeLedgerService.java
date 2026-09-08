package com.vastbricks.api.ledger.stripe;

import com.stripe.model.BalanceTransaction;
import com.vastbricks.api.client.stripe.StripeBalanceClient;
import com.vastbricks.api.ledger.LedgerPeriod;
import com.vastbricks.api.ledger.stripe.StripeLedgerPayload.CurrencySummaryResponse;
import com.vastbricks.api.ledger.stripe.StripeLedgerPayload.TransactionResponse;
import com.vastbricks.api.ledger.stripe.StripeLedgerPayload.TransactionsResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@RequiredArgsConstructor
class StripeLedgerService {

    /** Stripe reports money in the currency's minor units, so an amount is two decimal places to the left of it. */
    private static final int MINOR_UNIT_SCALE = 2;

    private final StripeBalanceClient stripeBalanceClient;
    private final StripeLedgerLinks links;

    TransactionsResponse transactionsOf(LedgerPeriod period) {
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

        return new TransactionsResponse(transactions, summaryOf(transactions, closingBalances(period)));
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
     * What Stripe deducted from the transaction, signed as a deduction, or {@code null} where it deducted nothing.
     *
     * <p>Stripe states a fee the other way up from PayPal — a positive number meaning money taken — so it is negated
     * here and the two ledgers state a fee alike. That is not only tidiness: a fee is a movement of the account, so
     * it is counted in the turnovers, and a fee whose sign was thrown away would be counted in the wrong direction.
     * Stripe does state a negative fee, when it gives back part of an application fee on a refund.
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
        return amount(transaction.getFee()).negate();
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
    /**
     * Where the account stood at the end of the period, per currency.
     *
     * <p>Stripe states one balance and it is the one at this moment, so the period's is worked back from it: what
     * the account holds now, less everything it has moved since the period ended. A period still running has moved
     * nothing since, so nothing is read and the answer is simply what Stripe holds.
     *
     * <p>Held and pending together, because what the account stood at is everything in it and not only the part it
     * could have spent that day. A transaction still to land is money the account has.
     *
     * <p>It is allowed to fail without taking the period down with it: reading back over a period long gone means
     * every transaction since, and a period the client will not walk that far for is better read without its
     * closing balance than not at all. It is logged where it fails, naming the period, because a foot quietly short
     * of a line says nothing about why.
     */
    private Map<String, BigDecimal> closingBalances(LedgerPeriod period) {
        try {
            Map<String, BigDecimal> held = new HashMap<>();
            var balance = stripeBalanceClient.retrieveBalance();
            if (balance.getAvailable() != null) {
                balance.getAvailable().forEach(money -> hold(held, money.getCurrency(), money.getAmount()));
            }
            if (balance.getPending() != null) {
                balance.getPending().forEach(money -> hold(held, money.getCurrency(), money.getAmount()));
            }

            var now = Instant.now();
            if (period.getTo().isBefore(now)) {
                for (var since : stripeBalanceClient.listBalanceTransactions(period.getTo().plusSeconds(1), now)) {
                    if (since.getNet() != null) {
                        held.merge(currency(since.getCurrency()), amount(since.getNet()).negate(), BigDecimal::add);
                    }
                }
            }
            return held;
        } catch (RuntimeException e) {
            log.error("Stripe closing balance could not be established for {} to {}", period.getFrom(), period.getTo(), e);
            return Map.of();
        }
    }

    /**
     * Stripe states what is held and what is pending as two lists of their own types rather than one, so each is
     * read by the two fields both of them carry.
     */
    private static void hold(Map<String, BigDecimal> held, String currency, Long minorUnits) {
        if (minorUnits != null) {
            held.merge(currency(currency), amount(minorUnits), BigDecimal::add);
        }
    }

    private static List<CurrencySummaryResponse> summaryOf(
            List<TransactionResponse> transactions,
            Map<String, BigDecimal> closingBalances
    ) {
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
                        entry.getValue().net,
                        closingBalances.get(entry.getKey())
                ))
                .toList();
    }

    /**
     * One currency's running totals while the period is being summed.
     *
     * <p>The turnovers are every movement of the account, which is the transaction's own gross <em>and</em> what
     * Stripe deducted from it. A fee is not a transaction of this ledger — Stripe takes it out of the one it belongs
     * to — but it is money that left the account all the same, and a bank charging the same fee would book it as an
     * entry of its own. Leaving it out of the turnover would make a ledger meant to be read against a statement
     * disagree with one.
     *
     * <p>So the turnovers come to the movement between them — credits less debits is the net — and the fee total is
     * a memo of how much of the debits were fees rather than a further subtraction. The PayPal ledger's foot says
     * the same things in the same order, the two being read against each other and against the bank statement.
     */
    private static final class Totals {

        private BigDecimal debitTurnover = zero();
        private BigDecimal creditTurnover = zero();
        /** Signed as each fee was, and already inside the turnovers above rather than a term beside them. */
        private BigDecimal fees = zero();
        private BigDecimal net = zero();

        private void add(TransactionResponse transaction) {
            if (transaction.getAmount() != null) {
                moved(transaction.getDirection() == StripeLedgerDirection.DEBIT
                        ? transaction.getAmount().negate()
                        : transaction.getAmount());
            }
            if (transaction.getFee() != null) {
                // Normally a debit; Stripe gives back part of an application fee on a refund, which is a credit and
                // is counted as one rather than as a debit of less than nothing.
                moved(transaction.getFee());
                fees = fees.add(transaction.getFee());
            }
            if (transaction.getNet() != null) {
                net = net.add(transaction.getNet());
            }
        }

        private void moved(BigDecimal amount) {
            if (amount.signum() < 0) {
                debitTurnover = debitTurnover.add(amount.abs());
            } else {
                creditTurnover = creditTurnover.add(amount);
            }
        }

        private static BigDecimal zero() {
            return BigDecimal.ZERO.setScale(MINOR_UNIT_SCALE);
        }
    }
}
