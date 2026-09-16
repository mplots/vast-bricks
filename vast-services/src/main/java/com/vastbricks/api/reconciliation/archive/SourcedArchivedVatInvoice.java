package com.vastbricks.api.reconciliation.archive;

import lombok.AllArgsConstructor;
import lombok.Getter;

/** One BrickLink order the store's archive holds the marketplace's VAT invoice for. */
@Getter
@AllArgsConstructor
class SourcedArchivedVatInvoice {

    private final String orderId;
}
