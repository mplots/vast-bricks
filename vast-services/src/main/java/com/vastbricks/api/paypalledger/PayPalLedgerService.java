package com.vastbricks.api.paypalledger;

import com.vastbricks.api.client.paypal.PayPalAmount;
import com.vastbricks.api.client.paypal.PayPalClient;
import com.vastbricks.api.client.paypal.PayPalPayerName;
import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.client.paypal.PayPalTransactionInfo;
import com.vastbricks.api.ledger.LedgerPeriod;
import com.vastbricks.api.paypalledger.PayPalLedgerPayload.BreakdownResponse;
import com.vastbricks.api.paypalledger.PayPalLedgerPayload.CurrencySummaryResponse;
import com.vastbricks.api.paypalledger.PayPalLedgerPayload.LineResponse;
import com.vastbricks.api.paypalledger.PayPalLedgerPayload.TransactionResponse;
import com.vastbricks.api.paypalledger.PayPalLedgerPayload.TransactionsResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * The PayPal ledger of one period, and what it came to.
 *
 * <p>Read live from PayPal every time the screen is opened, and stored nowhere, exactly as the Stripe ledger is: the
 * provider holds the account and answers for it. The bank statement screen stores its entries only because no
 * provider exposes that account, which is not the case here.
 *
 * <p>Every transaction PayPal reports for the period is listed rather than only the ones that paid for an order —
 * the payments, the refunds, the withdrawals to the bank. That is what makes the screen readable against a bank
 * statement in the first place. Deciding which of them pays for an order is reconciliation's business and stays
 * there.
 *
 * <p>A <em>transaction</em> here is what PayPal's own interface shows as one. PayPal reports what a reader thinks of
 * as one payment as several balance-affecting records: the payment, the commission the marketplace took as partner,
 * the conversions into the balance's currency. The record raised against nothing is the transaction; what was raised
 * against it is either deducted from its figures or carried as one of its lines, and never appears in the period as a
 * transaction of its own.
 */
@Service
@Slf4j
@RequiredArgsConstructor
class PayPalLedgerService {

    /** Money is shown to the cent, as every collected amount in the rewrite is. */
    private static final int SCALE = 2;

    /**
     * What PayPal takes out of a transaction on someone's behalf: the commission the marketplace charges as partner,
     * and the fee it charges for a dispute. Both are deductions from the transaction they name, so both are read as
     * part of what it cost rather than as movements of the account in their own right.
     *
     * <p>A conversion is not one of these. It takes nothing out of a transaction; it moves the whole of what was
     * left into another currency, which is why it restates the transaction rather than reducing it. See
     * {@link PayPalLedgerConversion}.
     */
    static final Set<String> DEDUCTION_EVENT_CODES = Set.of("T0113", "T0114");

    /** The commission the marketplace took as partner, which the detail view names in its own right. */
    private static final String PARTNER_COMMISSION_EVENT_CODE = "T0113";

    /** What PayPal charges for a dispute on a transaction, which the detail view names in its own right too. */
    private static final String DISPUTE_FEE_EVENT_CODE = "T0114";

    private final PayPalClient payPalClient;
    private final PayPalLedgerLinks links;

    TransactionsResponse transactionsOf(LedgerPeriod period) {
        var sourced = payPalClient.listTransactions(period.getFrom(), period.getTo());
        var groups = PayPalLedgerGroups.of(sourced);

        // What PayPal raised against each transaction, kept in the order PayPal listed them so a detail view reads
        // the way the provider reported it.
        Map<String, List<PayPalTransaction>> linesByHead = new LinkedHashMap<>();
        var heads = new ArrayList<PayPalTransaction>();
        for (var transaction : sourced) {
            var id = idOf(transaction);
            var head = groups.headOf(id);
            if (id == null || id.equals(head)) {
                heads.add(transaction);
            } else {
                linesByHead.computeIfAbsent(head, key -> new ArrayList<>()).add(transaction);
            }
        }

        var transactions = heads.stream()
                // Oldest first, the way a ledger is read and the way the bank statement screen lists a period: the
                // order the account moved in is the order the movement makes sense in. A transaction PayPal dated
                // nothing sorts last rather than first, and transactions sharing an instant keep PayPal's own order.
                .sorted(Comparator.comparing(
                        PayPalLedgerService::createdAt,
                        Comparator.nullsLast(Comparator.naturalOrder())
                ))
                .map(head -> transaction(head, linesByHead.getOrDefault(idOf(head), List.of())))
                .toList();

        return new TransactionsResponse(transactions, summaryOf(transactions, closingBalances(period)));
    }

    private TransactionResponse transaction(PayPalTransaction head, List<PayPalTransaction> lines) {
        var info = head.getTransactionInfo();
        var currency = currency(info);
        var amount = amount(info == null ? null : info.getTransactionAmount());

        var payPalFee = amount(info == null ? null : info.getFeeAmount());
        var partnerCommission = deducted(lines, currency, PARTNER_COMMISSION_EVENT_CODE::equals);
        var disputeFee = deducted(lines, currency, DISPUTE_FEE_EVENT_CODE::equals);
        // Everything taken out of the transaction, whoever took it: what a reader of the ledger wants one figure
        // for. The detail view is where it comes apart into PayPal's own lines again.
        var fee = sum(payPalFee, deducted(lines, currency, DEDUCTION_EVENT_CODES::contains));

        // And in the currency the account actually moved in, which is not the one the payment arrived in when
        // PayPal converted it.
        var stated = PayPalLedgerConversion.of(currency, amount, fee, lines);

        return TransactionResponse.builder()
                .id(idOf(head))
                .type(info == null ? null : trimmed(info.getTransactionEventCode()))
                .created(createdAt(head))
                .description(info == null ? null : trimmed(info.getTransactionSubject()))
                .invoiceId(info == null ? null : trimmed(info.getInvoiceId()))
                .counterparty(counterparty(head))
                .counterpartyEmail(head.getPayerInfo() == null
                        ? null
                        : trimmed(head.getPayerInfo().getEmailAddress()))
                // Unsigned, the way a bank states an entry's amount: which way the balance moved is the direction
                // beside it rather than a minus sign the column has to be read for.
                .amount(stated.getAmount() == null ? null : stated.getAmount().abs())
                .direction(PayPalLedgerDirection.of(stated.getAmount()))
                .fee(stated.getFee())
                // What the transaction left behind, which is the arithmetic PayPal's own panel ends on: the amount
                // it moved with everything taken out of it added back in, all of it signed already.
                .net(stated.getNet())
                .currency(stated.getCurrency())
                .status(info == null ? null : trimmed(info.getTransactionStatus()))
                .sourceId(info == null ? null : trimmed(info.getPayPalReferenceId()))
                .link(links.of(idOf(head)))
                .breakdown(breakdown(
                        info,
                        currency,
                        amount,
                        payPalFee,
                        partnerCommission,
                        disputeFee,
                        sum(amount, fee),
                        stated.getWithdrawn()
                ))
                .lines(lines.stream().map(line -> line(line, currency, stated.getCurrency())).toList())
                .build();
    }

    /**
     * What the gross was made up of, as PayPal's own transaction details panel lists it.
     *
     * <p>The purchase total is the only figure derived rather than stated: PayPal reports what it added to the
     * purchase — the tax, the shipping, the handling, the insurance and whatever was discounted — so what is left of
     * the gross once those are taken off is what was actually bought. A transaction PayPal broke down in no way at
     * all gets no purchase total rather than one equal to its gross, which would say a breakdown was stated when
     * none was.
     */
    private static BreakdownResponse breakdown(
            PayPalTransactionInfo info,
            String currency,
            BigDecimal gross,
            BigDecimal payPalFee,
            BigDecimal partnerCommission,
            BigDecimal disputeFee,
            BigDecimal net,
            BigDecimal conversion
    ) {
        if (info == null) {
            return null;
        }
        var salesTax = amount(info.getSalesTaxAmount());
        var shipping = amount(info.getShippingAmount());
        var handling = amount(info.getHandlingAmount());
        var insurance = amount(info.getInsuranceAmount());
        var discount = amount(info.getDiscountAmount());
        var shippingDiscount = amount(info.getShippingDiscountAmount());

        // Whichever of these PayPal stated; a list that holds the ones it did not, so the absent ones can be told
        // from a stated nought.
        var added = Arrays.asList(salesTax, shipping, handling, insurance, discount, shippingDiscount);
        BigDecimal purchaseTotal = null;
        if (gross != null && added.stream().anyMatch(Objects::nonNull)) {
            purchaseTotal = gross;
            for (var component : added) {
                if (component != null) {
                    purchaseTotal = purchaseTotal.subtract(component);
                }
            }
        }

        return BreakdownResponse.builder()
                .currency(currency)
                .purchaseTotal(purchaseTotal)
                .salesTax(salesTax)
                .shipping(shipping)
                .handling(handling)
                .insurance(insurance)
                .discount(discount)
                .shippingDiscount(shippingDiscount)
                .payPalFee(payPalFee)
                .partnerCommission(partnerCommission)
                .disputeFee(disputeFee)
                .gross(gross)
                .net(net)
                .conversion(conversion)
                .build();
    }

    private LineResponse line(PayPalTransaction transaction, String ownCurrency, String statedCurrency) {
        var info = transaction.getTransactionInfo();
        return LineResponse.builder()
                .accountedFor(accountedFor(transaction, ownCurrency, statedCurrency))
                .id(idOf(transaction))
                .created(createdAt(transaction))
                .type(info == null ? null : trimmed(info.getTransactionEventCode()))
                // Signed as PayPal stated it: this is a line of an account rather than a column of a table, so it
                // reads the way PayPal's own panel writes it.
                .amount(amount(info == null ? null : info.getTransactionAmount()))
                .currency(currency(info))
                .status(info == null ? null : trimmed(info.getTransactionStatus()))
                .link(links.of(idOf(transaction)))
                .build();
    }

    /**
     * Whether the amount details already state this record, and it therefore has nothing left to say beside them.
     *
     * <p>A deduction the panel names is stated by name, and a leg of the conversion the panel ends on is stated by
     * the two lines that end it. Anything else PayPal raised has no line of its own, so it is left to be listed.
     */
    private static boolean accountedFor(PayPalTransaction line, String ownCurrency, String statedCurrency) {
        var info = line.getTransactionInfo();
        var eventCode = info == null ? null : trimmed(info.getTransactionEventCode());
        var lineCurrency = currency(info);
        if (eventCode == null || lineCurrency == null) {
            return false;
        }
        if (DEDUCTION_EVENT_CODES.contains(eventCode)) {
            return lineCurrency.equals(ownCurrency);
        }
        return PayPalLedgerConversion.CONVERSION_EVENT_CODE.equals(eventCode)
                && (lineCurrency.equals(ownCurrency) || lineCurrency.equals(statedCurrency));
    }

    /**
     * What the lines took out of the transaction, in its own currency, or {@code null} where they took nothing.
     *
     * <p>Only the transaction's own currency, because a deduction PayPal raised in another one cannot be taken off a
     * figure in this one. It stays a line of the transaction, where the currency it was taken in is stated beside it.
     */
    private static BigDecimal deducted(
            List<PayPalTransaction> lines,
            String currency,
            Predicate<String> isDeduction
    ) {
        BigDecimal deducted = null;
        for (var line : lines) {
            var info = line.getTransactionInfo();
            var eventCode = info == null ? null : trimmed(info.getTransactionEventCode());
            if (eventCode == null || !isDeduction.test(eventCode)) {
                continue;
            }
            if (currency != null && !currency.equals(currency(info))) {
                continue;
            }
            deducted = sum(deducted, amount(info.getTransactionAmount()));
        }
        return deducted;
    }

    /**
     * Two amounts added, where either may be absent.
     *
     * <p>Nothing at all stays nothing, because a transaction PayPal deducted nothing from has no fee rather than a
     * fee of zero: PayPal takes its fee out of the transaction it belongs to rather than out of all of them, and a
     * fee column reading {@code 0.00} down every withdrawal says nothing a reader needs.
     */
    private static BigDecimal sum(BigDecimal one, BigDecimal other) {
        if (one == null) {
            return other;
        }
        return other == null ? one : one.add(other);
    }

    /**
     * Who the money moved to or from, as PayPal spells them.
     *
     * <p>PayPal spells a payer several ways and carries whichever ones it has, so they are tried in the order they
     * name a person best: the payer's own full name, then the parts it was given in, then the recipient the order
     * shipped to. A transaction with no counterparty at all — a withdrawal to the bank, a fee PayPal charged — is
     * left without one rather than given the account's own name.
     */
    private static String counterparty(PayPalTransaction transaction) {
        var payerInfo = transaction.getPayerInfo();
        var name = payerInfo == null ? null : payerInfo.getPayerName();
        var stated = firstStated(
                name == null ? null : name.getFullName(),
                name == null ? null : name.getAlternateFullName(),
                fullName(name),
                transaction.getShippingInfo() == null ? null : transaction.getShippingInfo().getName()
        );
        return trimmed(stated);
    }

    private static String fullName(PayPalPayerName name) {
        if (name == null) {
            return null;
        }
        var given = trimmed(name.getGivenName());
        var surname = trimmed(name.getSurname());
        if (given == null) {
            return surname;
        }
        return surname == null ? given : given + " " + surname;
    }

    private static String firstStated(String... values) {
        for (var value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private static String idOf(PayPalTransaction transaction) {
        var info = transaction.getTransactionInfo();
        return info == null ? null : trimmed(info.getTransactionId());
    }

    private static Instant createdAt(PayPalTransaction transaction) {
        var info = transaction.getTransactionInfo();
        if (info == null || info.getTransactionInitiationDate() == null) {
            return null;
        }
        return info.getTransactionInitiationDate().toInstant();
    }

    /** PayPal names a currency in upper case already; it is trimmed so a blank reads as none stated. */
    private static String currency(PayPalTransactionInfo info) {
        var amount = info == null ? null : info.getTransactionAmount();
        return amount == null ? null : trimmed(amount.getCurrencyCode());
    }

    private static BigDecimal amount(PayPalAmount amount) {
        if (amount == null || amount.getValue() == null) {
            return null;
        }
        return amount.getValue().setScale(SCALE, RoundingMode.HALF_UP);
    }

    private static String trimmed(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * What the period came to, one group per currency the account moved in and in currency order, so the foot of the
     * table reads the same way whichever period is asked for.
     *
     * <p>It is summed from the transactions listed rather than asked of PayPal, and from the transactions rather
     * than from the records they were reported as: a commission the marketplace took is already inside the fee of
     * the transaction it came out of, and counting it again as a movement of its own would state it twice.
     */
    /**
     * Where the account stood at the end of the period, per currency, as PayPal states it.
     *
     * <p>PayPal's own figure rather than one worked out, because unlike Stripe it answers for the balance at a
     * stated moment. A period still running is asked about as of now by the client, which is the only true answer
     * there is for it.
     *
     * <p>It is allowed to fail without taking the period down with it: a screen that cannot say where the account
     * stood is still worth reading for what the period did. It is logged where it fails, naming the period, because
     * a foot quietly short of a line says nothing about why.
     */
    private Map<String, BigDecimal> closingBalances(LedgerPeriod period) {
        try {
            Map<String, BigDecimal> balances = new HashMap<>();
            for (var balance : payPalClient.listBalances(period.getTo())) {
                var held = amount(balance.getTotalBalance());
                var currency = balance.getTotalBalance() == null
                        ? trimmed(balance.getCurrency())
                        : trimmed(balance.getTotalBalance().getCurrencyCode());
                if (held != null && currency != null) {
                    balances.merge(currency, held, BigDecimal::add);
                }
            }
            return balances;
        } catch (RuntimeException e) {
            log.error("PayPal closing balance could not be read for {} to {}", period.getFrom(), period.getTo(), e);
            return Map.of();
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
                        closingBalances.get(entry.getKey()),
                        entry.getValue().net
                ))
                .toList();
    }

    /**
     * One currency's running totals while the period is being summed.
     *
     * <p>The turnovers are every movement of the account, which is the transaction's own gross <em>and</em> what was
     * deducted from it. A fee is not a transaction of this ledger — it is folded into the one it came out of — but it
     * is money that left the account all the same, and a bank charging the same fee would book it as an entry of its
     * own. Leaving it out of the turnover would make a ledger meant to be read against a statement disagree with one.
     * The Stripe ledger's foot says the same things in the same order, the two being read against each other.
     *
     * <p>A conversion is the deliberate exception, and it is not a movement to leave out so much as one already
     * counted: a converted transaction is stated in the currency it was converted into, so its gross is already what
     * the account moved by there. Counting the legs as well would state the same money twice and invent a turnover
     * in a currency it only passed through.
     *
     * <p>So the turnovers come to the movement between them — credits less debits is the net — and the fee total is
     * a memo of how much of the debits were fees rather than a further subtraction.
     */
    private static final class Totals {

        private BigDecimal debitTurnover = zero();
        private BigDecimal creditTurnover = zero();
        /** Signed as each deduction was, and already inside the turnovers above rather than a term beside them. */
        private BigDecimal fees = zero();
        private BigDecimal net = zero();

        private void add(TransactionResponse transaction) {
            if (transaction.getAmount() != null) {
                moved(transaction.getDirection() == PayPalLedgerDirection.DEBIT
                        ? transaction.getAmount().negate()
                        : transaction.getAmount());
            }
            if (transaction.getFee() != null) {
                // Normally a debit; a refunded payment gives part of a fee back, which is a credit and is counted
                // as one rather than as a debit of less than nothing.
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
            return BigDecimal.ZERO.setScale(SCALE);
        }
    }
}
