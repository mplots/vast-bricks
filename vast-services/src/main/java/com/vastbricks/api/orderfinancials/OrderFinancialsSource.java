package com.vastbricks.api.orderfinancials;

/**
 * Collects one order's reported financials from the marketplace it was placed on. Adding a marketplace means adding an
 * implementation; the service selects one by its marketplace and does not know how the order is fetched.
 */
interface OrderFinancialsSource {

    OrderFinancialsMarketplace marketplace();

    ReportedOrderFinancials findFinancials(String orderId);
}
