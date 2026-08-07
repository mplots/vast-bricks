package com.vastbricks.accounting;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@AllArgsConstructor
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
