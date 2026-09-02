package com.vastbricks.api.invoice;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
class GenerateInvoiceRequest {
    private String orderId;
    private String source;
}
