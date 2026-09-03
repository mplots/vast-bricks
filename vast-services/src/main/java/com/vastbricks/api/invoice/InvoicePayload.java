package com.vastbricks.api.invoice;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Every request and response body of the invoice feature. */
final class InvoicePayload {

    private InvoicePayload() {
    }

    @Data
    @NoArgsConstructor
    public static final class GenerateInvoiceRequest {
        private String orderId;
        private String source;
    }

    @Data
    @AllArgsConstructor
    public static final class GenerateInvoiceResult {
        private String invoiceUuid;
        private String invoiceNumber;
        private String clientUuid;
        private String referenceId;
        private String name;
    }
}
