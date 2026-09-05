package com.vastbricks.api.tax;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * How an order is treated for tax, which is what decides how it is accounted for. The type is a property of the
 * order itself rather than of any one screen, so it is stated once here and every feature that needs it reads the
 * same vocabulary; {@link OrderTaxTypes} is what derives it from a marketplace's order.
 *
 * <p>The declared name is the wire value. It carries no display text: a client words it, as it words a failure code.
 */
@Getter
@RequiredArgsConstructor
public enum OrderTaxType {

    /** Sold within Latvia, with Latvian VAT charged. */
    DOMESTIC("domestic"),

    /** Sold into another EU member state, with VAT charged. */
    EUROPEAN_UNION("european-union"),

    /** Sold outside the EU, with no tax charged. */
    EXPORT("export"),

    /** Sold outside the EU, but with tax charged all the same, normally collected by the marketplace. */
    EXPORT_TAXABLE("export-taxable");

    @JsonValue
    private final String name;
}
