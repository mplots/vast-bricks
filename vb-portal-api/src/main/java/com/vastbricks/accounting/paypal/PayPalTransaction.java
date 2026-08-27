package com.vastbricks.accounting.paypal;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@AllArgsConstructor
public class PayPalTransaction {
    private String transactionId;
    private String referenceId;
    private LocalDate transactionDate;
    private OffsetDateTime transactionDateTime;
    private String eventCode;
    private String status;
    private BigDecimal amount;
    private BigDecimal fee;
    private String currency;
    private String invoiceId;
    private String customField;
    private String subject;
    private String payerName;
    private String shippingName;
}
