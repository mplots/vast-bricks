package com.vastbricks.api.invoice;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
class GenerateInvoiceResult {
    private String invoiceUuid;
    private String invoiceNumber;
    private String clientUuid;
    private String referenceId;
    private String name;
}
