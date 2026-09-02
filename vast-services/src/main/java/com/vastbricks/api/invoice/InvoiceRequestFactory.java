package com.vastbricks.api.invoice;

import com.vastbricks.api.client.manakabata.ManakabataInvoiceLine;
import com.vastbricks.api.client.manakabata.ManakabataInvoiceRequest;
import com.vastbricks.api.client.manakabata.ManakabataUuidReference;
import com.vastbricks.api.client.manakabata.model.PersonTypeEnum;
import com.vastbricks.api.client.manakabata.model.StoreClientRequest;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** What a generated invoice and the client it is issued to say. */
@Component
@RequiredArgsConstructor
class InvoiceRequestFactory {

    private static final String INVOICE_CATEGORY = "product";
    private static final String INVOICE_TYPE = "bill_of_landing";
    private static final String SELECTION_MODE_EXISTING = "existing";
    private static final String INVOICE_LOCALE = "en";
    private static final String INVOICE_CURRENCY = "EUR";

    private static final String LINE_NAME = "LEGO parts";
    private static final String LINE_MEASUREMENT = "pieces";
    private static final BigDecimal LINE_QUANTITY = BigDecimal.ONE;
    private static final String LINE_DISCOUNT_TYPE = "flat";
    private static final BigDecimal LINE_DISCOUNT = BigDecimal.ZERO;
    private static final BigDecimal LINE_TAX = BigDecimal.valueOf(21);
    private static final int AMOUNT_SCALE = 2;

    private final InvoiceSettings settings;

    /** The buyer, identified by the reference the order carries so repeat buyers keep one client. */
    StoreClientRequest clientRequest(InvoiceOrder order) {
        return new StoreClientRequest()
                .type(PersonTypeEnum.PERSON)
                .name(order.getName())
                .referenceId(order.getReferenceId())
                .isSelfEmployed(false)
                .isVatSpecial(false)
                .isSyncEnabled(false);
    }

    /** The invoice. Its note carries the order key, which is what reconciliation matches the invoice back on. */
    ManakabataInvoiceRequest invoiceRequest(String clientUuid, InvoiceOrder order, String invoiceNote) {
        return ManakabataInvoiceRequest.builder()
                .invoiceCategory(INVOICE_CATEGORY)
                .invoiceType(INVOICE_TYPE)
                .recipientSelectionMode(SELECTION_MODE_EXISTING)
                .recipient(new ManakabataUuidReference(clientUuid))
                .payerIsRecipient(true)
                .invoicedAt(order.getOrderDate())
                .invoiceLocale(INVOICE_LOCALE)
                .currency(INVOICE_CURRENCY)
                .invoiceNote(invoiceNote)
                .showCode(true)
                .showDiscount(true)
                .publicLink(true)
                .invoiceNumeratorSelectionMode(SELECTION_MODE_EXISTING)
                .invoiceNumerator(new ManakabataUuidReference(
                        required(settings.getInvoiceNumeratorUuid(), "Invoice numerator UUID is not configured")
                ))
                .teamBankAccountSelectionMode(SELECTION_MODE_EXISTING)
                .teamBankAccount(new ManakabataUuidReference(
                        required(settings.getTeamBankAccountUuid(), "Team bank account UUID is not configured")
                ))
                .products(List.of(invoiceLine(order.getSubTotal())))
                .build();
    }

    /**
     * The single line the invoice is issued for. Its price is the amount reconciliation compares against the order, so
     * it is rounded the way the order sub-total itself is; Manakabata reads the price as the price without VAT.
     */
    private ManakabataInvoiceLine invoiceLine(BigDecimal subTotal) {
        if (subTotal == null) {
            throw new InvoiceException("Order has no sub-total to invoice");
        }
        return ManakabataInvoiceLine.builder()
                .name(LINE_NAME)
                .measurement(LINE_MEASUREMENT)
                .quantity(LINE_QUANTITY)
                .price(subTotal.setScale(AMOUNT_SCALE, RoundingMode.HALF_UP))
                .discountType(LINE_DISCOUNT_TYPE)
                .discount(LINE_DISCOUNT)
                .tax(LINE_TAX)
                .build();
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new InvoiceException(message);
        }
        return value.trim();
    }
}
