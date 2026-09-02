package com.vastbricks.api.invoice;

/**
 * Looks one order up at the marketplace it was placed on. Adding a marketplace means adding an implementation; the
 * invoice service selects one by its marketplace and does not know how the order is fetched.
 */
interface InvoiceOrderSource {

    InvoiceOrderMarketplace marketplace();

    InvoiceOrder findOrder(String orderId);
}
