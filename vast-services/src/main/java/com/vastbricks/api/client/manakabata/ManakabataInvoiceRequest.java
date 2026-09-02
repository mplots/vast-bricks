package com.vastbricks.api.client.manakabata;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.time.LocalDate;
import java.util.List;
import lombok.Builder;
import lombok.Data;

/**
 * Payload of {@code POST /invoices}. Handwritten because the published specification types the recipient, numerator
 * and bank-account fields as arrays of strings, so the generated store request cannot express the lookup objects the
 * API actually expects.
 */
@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ManakabataInvoiceRequest {
    private String invoiceCategory;
    private String invoiceType;
    private String recipientSelectionMode;
    private ManakabataUuidReference recipient;
    private boolean payerIsRecipient;
    private LocalDate invoicedAt;
    private String invoiceLocale;
    private String currency;
    private String invoiceNote;
    private boolean showCode;
    private boolean showDiscount;
    @JsonProperty("is_public_link")
    private boolean publicLink;
    private String invoiceNumeratorSelectionMode;
    private ManakabataUuidReference invoiceNumerator;
    private String teamBankAccountSelectionMode;
    private ManakabataUuidReference teamBankAccount;
    private List<ManakabataInvoiceLine> products;
}
