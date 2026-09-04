package com.vastbricks.api.reconciliation.invoice;

import com.vastbricks.api.client.manakabata.ManakabataClient;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import com.vastbricks.api.reconciliation.Source;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the accounting invoices from Manakabata. The month is deliberately ignored: the list endpoint offers no
 * filter beyond the page size, and an order may be invoiced outside the month it was placed in, so the whole list is
 * requested and the mapper searches it.
 */
@Component
@RequiredArgsConstructor
class SourceManakabataInvoices implements Source<InvoiceIndex200ResponseDataInner> {

    private final ManakabataClient manakabataClient;

    @Override
    public Class<InvoiceIndex200ResponseDataInner> type() {
        return InvoiceIndex200ResponseDataInner.class;
    }

    @Override
    public List<InvoiceIndex200ResponseDataInner> fetch(YearMonth month) {
        return manakabataClient.listInvoices();
    }
}
