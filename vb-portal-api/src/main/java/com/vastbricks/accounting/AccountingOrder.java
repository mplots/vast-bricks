package com.vastbricks.accounting;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Data
public class AccountingOrder {
    private String source;
    private LocalDate orderDate;
    private String orderNumber;
    private String buyerName;
    private Integer lotCount;
    private Integer itemCount;
    private BigDecimal orderTotal;
    private BigDecimal vat;
    private String location;
    private BigDecimal shipping;
    private BigDecimal marketplaceTax;
    private BigDecimal grandTotal;
    private String paymentMethod;
    private String paymentProvider;
    private String paymentTransactionId;
    private String paymentCurrency;
    private OffsetDateTime paymentDateTime;
    private BigDecimal paidAmount;
    private String paymentMatchStatus;

    public AccountingOrder(
            String source,
            LocalDate orderDate,
            String orderNumber,
            String buyerName,
            Integer lotCount,
            Integer itemCount,
            BigDecimal orderTotal,
            BigDecimal vat,
            String location,
            BigDecimal shipping,
            BigDecimal marketplaceTax,
            BigDecimal grandTotal
    ) {
        this(
                source,
                orderDate,
                orderNumber,
                buyerName,
                lotCount,
                itemCount,
                orderTotal,
                vat,
                location,
                shipping,
                marketplaceTax,
                grandTotal,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );
    }

    public AccountingOrder(
            String source,
            LocalDate orderDate,
            String orderNumber,
            String buyerName,
            Integer lotCount,
            Integer itemCount,
            BigDecimal orderTotal,
            BigDecimal vat,
            String location,
            BigDecimal shipping,
            BigDecimal marketplaceTax,
            BigDecimal grandTotal,
            String paymentMethod,
            String paymentProvider,
            String paymentTransactionId,
            String paymentCurrency,
            OffsetDateTime paymentDateTime,
            BigDecimal paidAmount,
            String paymentMatchStatus
    ) {
        this.source = source;
        this.orderDate = orderDate;
        this.orderNumber = orderNumber;
        this.buyerName = buyerName;
        this.lotCount = lotCount;
        this.itemCount = itemCount;
        this.orderTotal = orderTotal;
        this.vat = vat;
        this.location = location;
        this.shipping = shipping;
        this.marketplaceTax = marketplaceTax;
        this.grandTotal = grandTotal;
        this.paymentMethod = paymentMethod;
        this.paymentProvider = paymentProvider;
        this.paymentTransactionId = paymentTransactionId;
        this.paymentCurrency = paymentCurrency;
        this.paymentDateTime = paymentDateTime;
        this.paidAmount = paidAmount;
        this.paymentMatchStatus = paymentMatchStatus;
    }

    public boolean isVatPresent() {
        return vat != null && vat.compareTo(BigDecimal.ZERO) != 0;
    }

    public boolean isMarketplaceTaxPresent() {
        return marketplaceTax != null && marketplaceTax.compareTo(BigDecimal.ZERO) != 0;
    }

    public BigDecimal getCalculatedGrandTotal() {
        return orderTotal == null || shipping == null || marketplaceTax == null
                ? null
                : orderTotal.add(shipping).add(marketplaceTax);
    }

    public boolean isGrandTotalMismatch() {
        var calculatedGrandTotal = getCalculatedGrandTotal();
        return calculatedGrandTotal != null
                && grandTotal != null
                && calculatedGrandTotal.compareTo(grandTotal) != 0;
    }
}
