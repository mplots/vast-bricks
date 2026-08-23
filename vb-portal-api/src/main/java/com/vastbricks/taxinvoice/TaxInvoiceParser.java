package com.vastbricks.taxinvoice;

import com.vastbricks.jpa.entity.Marketplace;

public interface TaxInvoiceParser {
    Marketplace marketplace();

    String countryCode();

    TaxInvoiceParseResult parse(TaxInvoiceParseRequest request);
}
