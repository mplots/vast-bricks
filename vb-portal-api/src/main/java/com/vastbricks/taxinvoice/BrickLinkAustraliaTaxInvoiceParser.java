package com.vastbricks.taxinvoice;

import com.vastbricks.jpa.entity.Marketplace;
import org.apache.commons.lang3.StringUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.regex.Pattern;

@Component
class BrickLinkAustraliaTaxInvoiceParser implements TaxInvoiceParser {
    private static final String EXPECTED_TAX_ID = "ARN 300027424132";
    private static final Pattern ORDER_NUMBER = Pattern.compile("(?is)ORDER\\s+NO\\.\\s*(\\d+)");
    private static final Pattern TAX_ID = Pattern.compile("(?im)^\\s*TAX\\s+ID:\\s*(ARN\\s+\\d+)\\s*$");

    @Override
    public Marketplace marketplace() {
        return Marketplace.BRICK_LINK;
    }

    @Override
    public String countryCode() {
        return "AU";
    }

    @Override
    public TaxInvoiceParseResult parse(TaxInvoiceParseRequest request) {
        var text = extractText(request.pdf());
        var invoiceNumber = find(ORDER_NUMBER, text, "Australian BrickLink order number");
        var taxId = find(TAX_ID, text, "Australian BrickLink tax ID");
        validateTaxId(taxId);
        validateInvoiceNumber(request, invoiceNumber);
        return new TaxInvoiceParseResult(taxId, invoiceNumber);
    }

    private void validateTaxId(String taxId) {
        if (!EXPECTED_TAX_ID.equals(taxId)) {
            throw new TaxInvoiceParserException(
                "Australian BrickLink tax ID mismatch: expected " + EXPECTED_TAX_ID + ", got " + taxId
            );
        }
    }

    private void validateInvoiceNumber(TaxInvoiceParseRequest request, String invoiceNumber) {
        if (request.orderId() != null && !invoiceNumber.equals(request.orderId().toString())) {
            throw new TaxInvoiceParserException(
                "Australian BrickLink invoice number " + invoiceNumber
                    + " does not match order number " + request.orderId()
            );
        }
    }

    private String extractText(byte[] pdf) {
        try (var document = PDDocument.load(pdf)) {
            return new PDFTextStripper().getText(document);
        } catch (IOException ex) {
            throw new TaxInvoiceParserException("Could not read Australian BrickLink tax invoice PDF", ex);
        }
    }

    private String find(Pattern pattern, String text, String field) {
        var matcher = pattern.matcher(StringUtils.defaultString(text));
        if (!matcher.find()) {
            throw new TaxInvoiceParserException("Could not parse " + field);
        }
        return matcher.group(1).trim().replaceAll("\\s+", " ");
    }
}
