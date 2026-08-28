package com.vastbricks.accounting;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class GenerateInvoiceResult {
    private String invoiceUuid;
    private String invoiceNumber;
    private String clientUuid;
    private String referenceId;
    private String name;
}
