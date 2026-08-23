package com.vastbricks.taxinvoice;

import com.vastbricks.jpa.entity.Marketplace;
import org.apache.commons.lang3.StringUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.regex.Pattern;

@Component
class BrickLinkUnitedKingdomTaxInvoiceParser implements TaxInvoiceParser {
    private static final String EXPECTED_TAX_ID = "GB364201624";
    private static final Pattern INVOICE_NUMBER = Pattern.compile("(?is)INVOICE\\s+NO\\.\\s*(UK\\d+)");
    private static final Pattern ORDER_NUMBER = Pattern.compile("(?im)^.*\\bOrder\\s+no\\.:\\s*(\\d+)\\s*$");
    private static final Pattern TAX_ID = Pattern.compile("(?im)^\\s*BrickLink\\s+VAT\\s+ID:\\s*(GB\\d+)\\s*$");

    @Override
    public Marketplace marketplace() {
        return Marketplace.BRICK_LINK;
    }

    @Override
    public String countryCode() {
        return "GB";
    }

    @Override
    public TaxInvoiceParseResult parse(TaxInvoiceParseRequest request) {
        var text = extractText(request.pdf());
        var taxId = find(TAX_ID, text, "United Kingdom BrickLink tax ID");
        var invoiceNumber = find(INVOICE_NUMBER, text, "United Kingdom BrickLink invoice number");
        var orderNumber = find(ORDER_NUMBER, text, "United Kingdom BrickLink order number");
        validateTaxId(taxId);
        validateFilename(request, orderNumber, invoiceNumber);
        return new TaxInvoiceParseResult(taxId, invoiceNumber);
    }

    private void validateTaxId(String taxId) {
        if (!EXPECTED_TAX_ID.equals(taxId)) {
            throw new TaxInvoiceParserException(
                "United Kingdom BrickLink tax ID mismatch: expected " + EXPECTED_TAX_ID + ", got " + taxId
            );
        }
    }

    private void validateFilename(TaxInvoiceParseRequest request, String orderNumber, String invoiceNumber) {
        var filename = StringUtils.defaultString(request.filename());
        if (!filename.contains(orderNumber) && !filename.contains(invoiceNumber)) {
            throw new TaxInvoiceParserException(
                "United Kingdom BrickLink filename " + filename
                    + " does not contain order number " + orderNumber
                    + " or invoice number " + invoiceNumber
            );
        }
    }

    private String extractText(byte[] pdf) {
        try (var document = PDDocument.load(pdf)) {
            return new PDFTextStripper().getText(document);
        } catch (IOException ex) {
            throw new TaxInvoiceParserException("Could not read United Kingdom BrickLink tax invoice PDF", ex);
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
