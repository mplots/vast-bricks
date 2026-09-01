package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;

/**
 * Accounting side of reconciliation. The month states which orders are being reconciled; a provider whose invoice list
 * cannot be filtered may ignore it and return everything it holds, because an order can be invoiced in a later month.
 */
public interface ReconciliationInvoiceSource {

    List<ReconciliationInvoice> findInvoices(YearMonth month);
}
