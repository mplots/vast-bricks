package com.vastbricks.api.invoice;

import com.vastbricks.api.charges.OrderTaxType;
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** The facts about a marketplace order that an accounting invoice is built from. */
@Getter
@AllArgsConstructor
class InvoiceOrder {

    /** Identifies the buyer across invoices, for example {@code bricklink:customer:some-username}. */
    private final String referenceId;

    /** Name the invoice is issued to. */
    private final String name;

    private final LocalDate orderDate;

    /** How the order is treated for tax, which is what decides the rate the invoice is issued under. */
    private final OrderTaxType taxType;

    /** Order total in the store's base currency, with shipping and additional charges included. */
    private final BigDecimal grandTotal;

    /** What the marketplace collected on the order under its own tax registration, or nothing where it collected none. */
    private final BigDecimal facilitatorTax;

    /**
     * The amount the invoice is issued for: the grand total less what the marketplace took as tax facilitator, that
     * tax having been charged under the marketplace's registration rather than the store's and so not the store's to
     * invoice. It is the gross amount, with whatever VAT the store itself charged still in it.
     */
    BigDecimal invoicedAmount() {
        if (grandTotal == null) {
            throw new InvoiceException("Order has no grand total to invoice");
        }
        return facilitatorTax == null ? grandTotal : grandTotal.subtract(facilitatorTax);
    }
}
