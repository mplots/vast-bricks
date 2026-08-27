package com.vastbricks.accounting.stripe;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
@AllArgsConstructor
public class StripeTransaction {
    private String id;
    private String sourceId;
    private LocalDate transactionDate;
    private OffsetDateTime transactionDateTime;
    private String type;
    private String reportingCategory;
    private String status;
    private String description;
    private String currency;
    private Long amountMinor;
    private Long feeMinor;
    private Long netMinor;
    private BigDecimal amount;
    private BigDecimal fee;
    private BigDecimal net;
}
