package com.vastbricks.api.orderarchive;

import java.util.List;
import java.util.Optional;

/**
 * Which of the store's orders the marketplace issues a VAT invoice for.
 *
 * <p>The one thing the archive cannot answer for itself. An invoice is owed where BrickLink collected the tax under
 * its own registration, which is a typing of the order rather than a property of any file, so the archive asks
 * whoever holds the store's orders and compares the answer against what it has on disk.
 *
 * <p>An interface so the dependency runs one way, as it does for reconciliation's sources: the orders feature is
 * built out of the archive and already reads it, and a boundary declared here is what keeps the archive from
 * reading back into the table that was derived from it.
 */
public interface VatInvoiceOrders {

    /** Every order of the bound tenant the marketplace issues a VAT invoice for, newest first. */
    List<VatInvoiceOrder> invoiced();

    /** The order an invoice was posted for, or empty where this store holds no such order. */
    Optional<VatInvoiceOrder> byOrderId(String orderId);
}
