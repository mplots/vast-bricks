package com.vastbricks.api.reconciliation.accounting;

import com.vastbricks.api.client.manakabata.ManakabataClientException;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import com.vastbricks.api.reconciliation.DetailMapper;
import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.reconciliation.ReconciledOrders;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Merges each accounting invoice onto the order it belongs to. An invoice carries no order identifier of its own, so
 * the order is read from the note the invoice was created with — the note the {@code invoice} feature writes — and
 * that note is what decides the match, which is why it is parsed here rather than in the source.
 *
 * <p>All three amounts come from the same invoice, so they are merged together or not at all: an order with an
 * accounting sub-total and no accounting grand total would be an invoice that stated one and not the other, which is
 * a different fact from Manakabata having reported neither.
 */
@Component
@Order(8)
class MapperManakabataInvoices implements DetailMapper<InvoiceIndex200ResponseDataInner> {

    private static final Pattern INVOICE_NOTE = Pattern.compile(
            "^(bricklink|brickowl)(?::| order )(\\S+)$",
            Pattern.CASE_INSENSITIVE
    );

    @Override
    public Class<InvoiceIndex200ResponseDataInner> type() {
        return InvoiceIndex200ResponseDataInner.class;
    }

    @Override
    public void map(List<InvoiceIndex200ResponseDataInner> sourced, ReconciledOrders orders) {
        // The first invoice of an order wins: a later one does not overwrite what was already matched.
        Set<ReconciledOrder> invoiced = Collections.newSetFromMap(new IdentityHashMap<>());
        for (var invoice : sourced) {
            var note = invoiceNote(invoice);
            if (note == null) {
                continue;
            }
            for (var order : orders.find(marketplace(note.group(1)), note.group(2))) {
                if (invoiced.add(order)) {
                    merge(invoice, order);
                }
            }
        }
    }

    private void merge(InvoiceIndex200ResponseDataInner invoice, ReconciledOrder order) {
        var accounting = order.getAccounting();
        accounting.setSubTotal(ReconciliationAmount.normalize(toAmount(invoice, invoice.getSubtotal())));
        accounting.setVat(ReconciliationAmount.normalize(toAmount(invoice, invoice.getTax())));
        accounting.setGrandTotal(ReconciliationAmount.normalize(toAmount(invoice, invoice.getTotal())));
    }

    /** The matched note of an invoice that names an order, or {@code null} when the note names none. */
    private Matcher invoiceNote(InvoiceIndex200ResponseDataInner invoice) {
        if (invoice.getInvoiceNote() == null) {
            return null;
        }
        var note = INVOICE_NOTE.matcher(invoice.getInvoiceNote().trim());
        return note.matches() ? note : null;
    }

    private String marketplace(String source) {
        return source.equalsIgnoreCase("bricklink") ? Marketplace.BRICK_LINK : Marketplace.BRICK_OWL;
    }

    /** The specification declares the invoice amounts without a type, so every generated field is untyped. */
    private BigDecimal toAmount(InvoiceIndex200ResponseDataInner invoice, Object amount) {
        if (amount == null) {
            return null;
        }
        var text = String.valueOf(amount).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException ex) {
            throw new ManakabataClientException(
                    "Manakabata invoice " + invoice.getInvoiceNumber() + " has a non-numeric amount: " + text, ex
            );
        }
    }
}
