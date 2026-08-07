package com.vastbricks.accounting;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AccountingSummaryTest {
    @Test
    void totalsEveryNumericAccountingColumn() {
        var first = new AccountingOrder(
                "BrickLink", LocalDate.of(2026, 8, 1), "1", "Buyer", 3, 5,
                new BigDecimal("10.00"), new BigDecimal("2.00"), "Latvia",
                new BigDecimal("4.00"), new BigDecimal("1.00"), new BigDecimal("15.00")
        );
        var second = new AccountingOrder(
                "Brick Owl", LocalDate.of(2026, 8, 2), "2", "Buyer", 2, 7,
                new BigDecimal("20.00"), null, "Germany",
                new BigDecimal("5.00"), BigDecimal.ZERO, new BigDecimal("25.00")
        );

        var summary = AccountingSummary.from(List.of(first, second));

        assertEquals(5, summary.getLotCount());
        assertEquals(12, summary.getItemCount());
        assertEquals(new BigDecimal("30.00"), summary.getOrderTotal());
        assertEquals(new BigDecimal("9.00"), summary.getShipping());
        assertEquals(new BigDecimal("1.00"), summary.getMarketplaceTax());
        assertEquals(new BigDecimal("40.00"), summary.getGrandTotal());
        assertEquals(new BigDecimal("2.00"), summary.getVat());
    }
}
