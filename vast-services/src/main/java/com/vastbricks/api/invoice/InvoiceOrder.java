package com.vastbricks.api.invoice;

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

    /** Amount the invoice is issued for, before shipping and other charges. */
    private final BigDecimal subTotal;
}
