package com.vastbricks.integration.manakabata;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

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
}
