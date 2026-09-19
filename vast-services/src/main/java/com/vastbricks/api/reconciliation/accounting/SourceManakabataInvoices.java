package com.vastbricks.api.reconciliation.accounting;

import com.vastbricks.api.client.manakabata.ManakabataClient;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.util.List;
import lombok.RequiredArgsConstructor;

/**
 * Fetches the accounting invoices from Manakabata. The selected date range is deliberately ignored: the list endpoint offers no
 * filter beyond the page size, and an order may be invoiced outside the month it was placed in, so the whole list is
 * requested and the mapper searches it.
 *
 * <p>Temporarily not registered as a bean, so this source fetches nothing until the {@code @Component} annotation is
 * restored. An unsourced class is not an error - {@code SourcedData} answers an empty list for it - so
 * {@link MapperManakabataInvoices} runs as normal with no accounting invoices to merge.
 */
@RequiredArgsConstructor
class SourceManakabataInvoices implements Source<InvoiceIndex200ResponseDataInner> {

    private final ManakabataClient manakabataClient;

    @Override
    public Class<InvoiceIndex200ResponseDataInner> type() {
        return InvoiceIndex200ResponseDataInner.class;
    }

    @Override
    public List<InvoiceIndex200ResponseDataInner> fetch(ReconciliationPeriod period) {
        return manakabataClient.listInvoices();
    }
}
