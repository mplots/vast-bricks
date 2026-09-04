package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.client.paypal.PayPalTransaction;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/** What the PayPal payment mappers share: which transactions pay for an order, what one paid, and who paid it. */
final class PayPalPayments {

    /**
     * The event code of a payment received. PayPal reports the marketplace's seller fees, currency conversions,
     * refunds and bank withdrawals in the same list; none of those says what an order was paid, so they are sourced
     * and left unmapped until requirements for them are supplied.
     */
    private static final String PAYMENT_RECEIVED = "T0006";

    /** The payment method name the mapping unified PayPal's wording to. */
    private static final String PAYPAL = "PayPal";

    /**
     * Orders the marketplace says were settled through PayPal. A PayPal payment can only belong to one of those, and
     * the weaker match keys would otherwise attach one to an order paid another way.
     */
    static final Predicate<ReconciledOrder> PAID_THROUGH_PAYPAL = order -> PAYPAL.equals(order.getPaymentMethod());

    private PayPalPayments() {
    }

    static boolean paysForOrder(PayPalTransaction transaction) {
        return transaction.getTransactionInfo() != null
                && PAYMENT_RECEIVED.equalsIgnoreCase(transaction.getTransactionInfo().getTransactionEventCode());
    }

    /** What the transaction took, gross of PayPal's fee, normalized like every other collected amount. */
    static BigDecimal paidAmount(PayPalTransaction transaction) {
        var amount = transaction.getTransactionInfo().getTransactionAmount();
        return amount == null ? null : ReconciliationAmount.normalize(amount.getValue());
    }

    /** The day PayPal took the payment, in the UTC it reports the transaction in. */
    static LocalDate paymentDate(PayPalTransaction transaction) {
        var initiated = transaction.getTransactionInfo().getTransactionInitiationDate();
        return initiated == null ? null : initiated.toLocalDate();
    }

    /** What the marketplace labelled the payment with, or {@code null} when it labelled it with nothing. */
    static String invoiceId(PayPalTransaction transaction) {
        var invoiceId = transaction.getTransactionInfo().getInvoiceId();
        return invoiceId == null || invoiceId.isBlank() ? null : invoiceId.trim();
    }

    /**
     * Every name the transaction gives the buyer, most specific first. PayPal spells the payer and the shipping
     * recipient separately and the two often disagree, so a match on either counts.
     */
    static List<String> buyerNames(PayPalTransaction transaction) {
        var names = new ArrayList<String>();
        if (transaction.getPayerInfo() != null && transaction.getPayerInfo().getPayerName() != null) {
            var payerName = transaction.getPayerInfo().getPayerName();
            names.add(payerName.getAlternateFullName());
            names.add(payerName.getFullName());
            names.add(joined(payerName.getGivenName(), payerName.getSurname()));
        }
        if (transaction.getShippingInfo() != null) {
            names.add(transaction.getShippingInfo().getName());
        }
        return names.stream().filter(name -> name != null && !name.isBlank()).toList();
    }

    private static String joined(String givenName, String surname) {
        if (givenName == null || surname == null) {
            return null;
        }
        return givenName + ' ' + surname;
    }
}
