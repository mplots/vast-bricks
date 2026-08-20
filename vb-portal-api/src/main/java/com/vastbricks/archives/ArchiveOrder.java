package com.vastbricks.archives;

import com.vastbricks.accounting.AccountingOrder;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ArchiveOrder {
    private final AccountingOrder order;
    private final boolean apiArchived;
    private final boolean accountingArchived;
    private final VatInvoiceArchiveStatus vatInvoiceStatus;

    public boolean isVatInvoiceArchived() {
        return vatInvoiceStatus == VatInvoiceArchiveStatus.AVAILABLE;
    }

    public boolean isVatInvoiceMissing() {
        return vatInvoiceStatus == VatInvoiceArchiveStatus.MISSING;
    }

    public boolean isVatInvoiceNotRequired() {
        return vatInvoiceStatus == VatInvoiceArchiveStatus.NOT_REQUIRED;
    }

}
