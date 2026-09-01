package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.manakabata.ManakabataClient;
import com.vastbricks.api.client.manakabata.ManakabataClientException;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Collects accounting invoices from Manakabata. An invoice carries no order identifier of its own, so the order it
 * belongs to is read from the note the invoice was created with. The whole list is searched: the endpoint offers no
 * filter, and an order may be invoiced outside the month it was placed in.
 */
@Component
@Order(1)
@RequiredArgsConstructor
class ManakabataInvoiceSource implements ReconciliationInvoiceSource {

    private static final Pattern INVOICE_NOTE = Pattern.compile(
            "^(bricklink|brickowl)(?::| order )(\\S+)$",
            Pattern.CASE_INSENSITIVE
    );

    private final ManakabataClient manakabataClient;

    @Override
    public List<ReconciliationInvoice> findInvoices(YearMonth month) {
        var invoices = new ArrayList<ReconciliationInvoice>();
        for (var invoice : manakabataClient.listInvoices()) {
            var note = invoice.getInvoiceNote() == null ? null : INVOICE_NOTE.matcher(invoice.getInvoiceNote().trim());
            if (note == null || !note.matches()) {
                continue;
            }
            invoices.add(new ReconciliationInvoice(
                    sourceLabel(note.group(1)),
                    note.group(2),
                    ReconciliationAmount.normalize(toAmount(invoice))
            ));
        }
        return List.copyOf(invoices);
    }

    private String sourceLabel(String source) {
        return source.equalsIgnoreCase("bricklink")
                ? ReconciliationSource.BRICK_LINK
                : ReconciliationSource.BRICK_OWL;
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
