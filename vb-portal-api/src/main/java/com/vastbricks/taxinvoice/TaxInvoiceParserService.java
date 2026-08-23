package com.vastbricks.taxinvoice;

import com.vastbricks.jpa.entity.Marketplace;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TaxInvoiceParserService {
    private final List<TaxInvoiceParser> parsers;

    public TaxInvoiceParseResult parse(Marketplace marketplace, String countryCode, TaxInvoiceParseRequest request) {
        var parser = parsers.stream()
            .filter(candidate -> candidate.marketplace() == marketplace)
            .filter(candidate -> StringUtils.equalsIgnoreCase(candidate.countryCode(), countryCode))
            .findFirst()
            .orElseThrow(() -> new TaxInvoiceParserException(
                "No tax invoice parser available for " + marketplace + " " + countryCode
            ));

        return parser.parse(request);
    }
}
