package com.vastbricks.api.reconciliation.invoice;

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
import org.springframework.stereotype.Component;

/**
 * Merges each accounting invoice onto the order it belongs to. An invoice carries no order identifier of its own, so
 * the order is read from the note the invoice was created with; that note is what decides the match, which is why it
 * is parsed here rather than in the source.
 */
@Component
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
            var subTotal = ReconciliationAmount.normalize(toAmount(invoice));
            for (var order : orders.find(marketplace(note.group(1)), note.group(2))) {
                if (invoiced.add(order)) {
                    order.setInvoiceSubTotal(subTotal);
                }
            }
        }
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

    /** The specification declares the invoice amounts without a type, so the generated field is untyped. */
    private BigDecimal toAmount(InvoiceIndex200ResponseDataInner invoice) {
        if (invoice.getSubtotal() == null) {
            return null;
        }
        var text = String.valueOf(invoice.getSubtotal()).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException ex) {
            throw new ManakabataClientException(
                    "Manakabata invoice " + invoice.getInvoiceNumber() + " has a non-numeric sub-total: " + text, ex
            );
        }
    }
}
