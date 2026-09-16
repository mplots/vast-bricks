package com.vastbricks.api.reconciliation.archive;

import com.vastbricks.api.orderarchive.OrderArchive;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import com.vastbricks.api.reconciliation.Source;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Lists the orders the store's own archive holds a BrickLink VAT invoice for.
 *
 * <p>A source like any other, though what it reads is a directory rather than a provider: it is still an account of
 * the month collected before anything is judged, and reading it here rather than in a rule is what keeps one listing
 * from becoming one per order.
 *
 * <p>The period is not asked of it. The archive names a file after the moment the order last changed, which is not
 * the date the order was placed on, so narrowing the listing by the reconciled period would hide the invoice of
 * every order that has been touched since. A store's whole archive is a directory listing, and the mapper drops
 * whatever the month did not collect.
 */
@Component
@RequiredArgsConstructor
class SourceArchivedVatInvoices implements Source<SourcedArchivedVatInvoice> {

    private final OrderArchive orderArchive;

    @Override
    public Class<SourcedArchivedVatInvoice> type() {
        return SourcedArchivedVatInvoice.class;
    }

    @Override
    public List<SourcedArchivedVatInvoice> fetch(ReconciliationPeriod period) {
        return orderArchive.vatInvoiceOrderIds().stream().map(SourcedArchivedVatInvoice::new).toList();
    }
}
