package com.vastbricks.api.reconciliation.rule;

import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ARCHIVE_VAT_INVOICE;
import static com.vastbricks.api.reconciliation.ReconciliationOrderField.ORDER_TAX_TYPE;
import static com.vastbricks.api.reconciliation.rule.ReconciliationFailureLevel.ERROR;

import com.vastbricks.api.reconciliation.Marketplace;
import com.vastbricks.api.reconciliation.ReconciledOrder;
import com.vastbricks.api.charges.OrderTaxType;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Every order BrickLink collected the tax on must have its VAT invoice in the store's archive.
 *
 * <p>Such an order is the one case where the marketplace charged tax under its own registration on a sale outside
 * the EU, and BrickLink issues a VAT invoice of its own for it. The store did not write that invoice and cannot
 * write it again: it is the marketplace's document, served for as long as the marketplace cares to serve it, and the
 * store's copy is the only one that will still be there when an inspection asks. An export-taxable order with
 * nothing archived is therefore an error rather than a remark - there is a document to go and fetch, and a date by
 * which it can no longer be fetched at all.
 *
 * <p>The rule applies to no other order. BrickOwl issues nothing answering to it, and a BrickLink order of any other
 * tax type was either taxed under the store's own registration, in which case the store's own invoice is the record,
 * or taxed by nobody. An archived invoice on such an order is not reported either: it would say the marketplace
 * issued a document nobody asked it to, which is BrickLink's business rather than a reconciliation failure, and the
 * archive is a copy of what was shown rather than a claim that it was due.
 */
@Component
class RuleVatInvoiceArchived implements Rule {

    private static final String VAT_INVOICE_MISSING = "vat-invoice-missing";

    @Override
    public List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        if (!Marketplace.BRICK_LINK.equals(order.getOrder().getSource())
                || order.getOrder().getTaxType() != OrderTaxType.EXPORT_TAXABLE
                || Boolean.TRUE.equals(order.getArchive().getVatInvoice())) {
            return List.of();
        }
        // The tax type is cited beside the missing invoice because it is the whole of why one is owed: a reader
        // looking at the failure is being told which orders this applies to as well as that this one failed.
        return List.of(new ReconciliationFailure(VAT_INVOICE_MISSING, ERROR, List.of(ARCHIVE_VAT_INVOICE, ORDER_TAX_TYPE)));
    }
}
