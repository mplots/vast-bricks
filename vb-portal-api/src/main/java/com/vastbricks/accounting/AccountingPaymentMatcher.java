package com.vastbricks.accounting;

import com.vastbricks.accounting.paypal.PayPalTransaction;
import com.vastbricks.accounting.stripe.StripeTransaction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AccountingPaymentMatcher {
    private static final String BRICK_OWL = "Brick Owl";
    private static final String BRICK_LINK = "BrickLink";
    private static final String PAYPAL = "PayPal";
    private static final String STRIPE = "Stripe";
    private static final Pattern BRICK_OWL_ORDER_DESCRIPTION = Pattern.compile("\\bBrick Owl Order\\s+#?(\\S+)\\b");
    private static final Duration PAYMENT_MATCH_WINDOW = Duration.ofMinutes(10);

    public List<AccountingOrder> matchPayPal(List<AccountingOrder> orders, List<PayPalTransaction> payPalTransactions) {
        var transactionsById = index(payPalTransactions, PayPalTransaction::getTransactionId);
        var transactionsByInvoiceId = index(payPalTransactions, PayPalTransaction::getInvoiceId);

        for (var order : orders) {
            if (BRICK_OWL.equals(order.getSource())) {
                matchBrickOwl(order, transactionsById, transactionsByInvoiceId);
            } else if (BRICK_LINK.equals(order.getSource())) {
                matchBrickLink(order, payPalTransactions);
            }
        }

        return orders;
    }

    public List<AccountingOrder> matchStripe(List<AccountingOrder> orders, List<StripeTransaction> stripeTransactions) {
        var transactionsById = index(stripeTransactions, StripeTransaction::getId);
        var transactionsBySourceId = index(stripeTransactions, StripeTransaction::getSourceId);
        var transactionsByBrickOwlOrderNumber = index(stripeTransactions, this::brickOwlOrderNumber);

        for (var order : orders) {
            if (BRICK_OWL.equals(order.getSource())) {
                matchBrickOwlStripe(order, transactionsById, transactionsBySourceId, transactionsByBrickOwlOrderNumber);
            } else if (BRICK_LINK.equals(order.getSource())) {
                matchBrickLinkStripe(order, stripeTransactions);
            }
        }

        return orders;
    }

    private void matchBrickOwl(
            AccountingOrder order,
            Map<String, PayPalTransaction> transactionsById,
            Map<String, PayPalTransaction> transactionsByInvoiceId
    ) {
        if (!PAYPAL.equals(order.getPaymentMethod())) {
            return;
        }

        var transaction = transactionsById.get(order.getPaymentTransactionId());
        if (transaction == null) {
            transaction = transactionsByInvoiceId.get(order.getOrderNumber());
        }

        if (transaction == null) {
            order.setPaymentMatchStatus("UNMATCHED");
            return;
        }

        applyMatch(order, transaction);
    }

    private void matchBrickLink(AccountingOrder order, List<PayPalTransaction> payPalTransactions) {
        if (!PAYPAL.equals(order.getPaymentMethod())) {
            return;
        }

        if (payPalTransactions == null || payPalTransactions.isEmpty()) {
            order.setPaymentMatchStatus("UNMATCHED");
            return;
        }

        var matches = payPalTransactions.stream()
                .filter(transaction -> matchesAmount(order, transaction))
                .filter(transaction -> matchesPaymentTime(order, transaction))
//                .filter(transaction -> matchesBuyerName(order, transaction))
                .toList();

        if (matches.size() == 1) {
            applyMatch(order, matches.getFirst());
        } else if (matches.size() > 1) {
            order.setPaymentMatchStatus("MULTIPLE_MATCHES");
        } else {
            order.setPaymentMatchStatus("UNMATCHED");
        }
    }

    private void matchBrickOwlStripe(
            AccountingOrder order,
            Map<String, StripeTransaction> transactionsById,
            Map<String, StripeTransaction> transactionsBySourceId,
            Map<String, StripeTransaction> transactionsByBrickOwlOrderNumber
    ) {
        if (!STRIPE.equals(order.getPaymentMethod())) {
            return;
        }

        var transaction = transactionsBySourceId.get(order.getPaymentTransactionId());
        if (transaction == null) {
            transaction = transactionsById.get(order.getPaymentTransactionId());
        }
        if (transaction == null) {
            transaction = transactionsByBrickOwlOrderNumber.get(order.getOrderNumber());
        }

        if (transaction == null) {
            order.setPaymentMatchStatus("UNMATCHED");
            return;
        }

        applyMatch(order, transaction);
    }

    private void matchBrickLinkStripe(AccountingOrder order, List<StripeTransaction> stripeTransactions) {
        if (!STRIPE.equals(order.getPaymentMethod())) {
            return;
        }

        if (stripeTransactions == null || stripeTransactions.isEmpty()) {
            order.setPaymentMatchStatus("UNMATCHED");
            return;
        }

        var matches = stripeTransactions.stream()
                .filter(transaction -> matchesAmount(order, transaction))
                .filter(transaction -> Objects.equals(order.getOrderDate(), transaction.getTransactionDate()))
                .toList();

        if (matches.size() == 1) {
            applyMatch(order, matches.getFirst());
        } else if (matches.size() > 1) {
            order.setPaymentMatchStatus("MULTIPLE_MATCHES");
        } else {
            order.setPaymentMatchStatus("UNMATCHED");
        }
    }

    private void applyMatch(AccountingOrder order, PayPalTransaction transaction) {
        order.setPaymentProvider(PAYPAL);
        order.setPaidAmount(transaction.getAmount());
        order.setPaymentMatchStatus(matchesAmount(order, transaction) ? "MATCHED" : "AMOUNT_MISMATCH");
    }

    private void applyMatch(AccountingOrder order, StripeTransaction transaction) {
        order.setPaymentProvider(STRIPE);
        order.setPaidAmount(transaction.getAmount());
        order.setPaymentMatchStatus(matchesAmount(order, transaction) ? "MATCHED" : "AMOUNT_MISMATCH");
    }

    public List<AccountingOrder> matchBrickOwlPayPal(List<AccountingOrder> orders, List<PayPalTransaction> payPalTransactions) {
        return matchPayPal(orders, payPalTransactions);
    }

    private <T> Map<String, T> index(
            List<T> transactions,
            Function<T, String> keyExtractor
    ) {
        if (transactions == null || transactions.isEmpty()) {
            return Map.of();
        }
        return transactions.stream()
                .filter(transaction -> keyExtractor.apply(transaction) != null)
                .collect(Collectors.toMap(
                        keyExtractor,
                        Function.identity(),
                        (first, ignored) -> first
                ));
    }

    private boolean matchesAmount(AccountingOrder order, PayPalTransaction transaction) {
        return sameCurrency(order.getPaymentCurrency(), transaction.getCurrency())
                && sameAmount(order.getGrandTotal(), transaction.getAmount());
    }

    private boolean matchesAmount(AccountingOrder order, StripeTransaction transaction) {
        return sameCurrency(order.getPaymentCurrency(), transaction.getCurrency())
                && sameAmount(order.getGrandTotal(), transaction.getAmount());
    }

    private String brickOwlOrderNumber(StripeTransaction transaction) {
        if (transaction.getDescription() == null) {
            return null;
        }
        var matcher = BRICK_OWL_ORDER_DESCRIPTION.matcher(transaction.getDescription());
        return matcher.find() ? matcher.group(1) : null;
    }

    private boolean sameCurrency(String first, String second) {
        return Objects.equals(normalize(first), normalize(second));
    }

    private String normalize(String value) {
        return value == null ? null : value.trim().toUpperCase();
    }

    private boolean matchesBuyerName(AccountingOrder order, PayPalTransaction transaction) {
        var buyerName = comparableText(order.getBuyerName());
        if (buyerName == null) {
            return false;
        }
        return buyerName.equals(comparableText(transaction.getPayerName()))
                || buyerName.equals(comparableText(transaction.getShippingName()));
    }

    private boolean matchesPaymentTime(AccountingOrder order, PayPalTransaction transaction) {
        if (order.getPaymentDateTime() != null && transaction.getTransactionDateTime() != null) {
            var difference = Duration.between(
                    order.getPaymentDateTime().toInstant(),
                    transaction.getTransactionDateTime().toInstant()
            ).abs();
            return difference.compareTo(PAYMENT_MATCH_WINDOW) <= 0;
        }
        return Objects.equals(order.getOrderDate(), transaction.getTransactionDate());
    }

    private String comparableText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim().toLowerCase().replaceAll("\\s+", " ");
    }

    private boolean sameAmount(BigDecimal first, BigDecimal second) {
        return first != null
                && second != null
                && first.setScale(2, java.math.RoundingMode.HALF_UP)
                .compareTo(second.setScale(2, java.math.RoundingMode.HALF_UP)) == 0;
    }
}
