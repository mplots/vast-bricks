package com.vastbricks.accounting;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.function.Function;

@Data
@AllArgsConstructor
public class AccountingSummary {
    private Integer lotCount;
    private Integer itemCount;
    private BigDecimal orderTotal;
    private BigDecimal shipping;
    private BigDecimal marketplaceTax;
    private BigDecimal grandTotal;
    private BigDecimal vat;

    public static AccountingSummary from(List<AccountingOrder> orders) {
        return new AccountingSummary(
                orders.stream().mapToInt(order -> value(order.getLotCount())).sum(),
                orders.stream().mapToInt(order -> value(order.getItemCount())).sum(),
                sum(orders, AccountingOrder::getOrderTotal),
                sum(orders, AccountingOrder::getShipping),
                sum(orders, AccountingOrder::getMarketplaceTax),
                sum(orders, AccountingOrder::getGrandTotal),
                sum(orders, AccountingOrder::getVat)
        );
    }

    private static int value(Integer value) {
        return value == null ? 0 : value;
    }

    private static BigDecimal sum(
            List<AccountingOrder> orders,
            Function<AccountingOrder, BigDecimal> amount
    ) {
        return orders.stream()
                .map(amount)
                .filter(value -> value != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
