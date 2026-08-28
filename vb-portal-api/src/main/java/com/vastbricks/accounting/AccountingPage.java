package com.vastbricks.accounting;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class AccountingPage {
    private String selectedMonth;
    private List<AccountingOrder> orders;
    private AccountingSummary summary;
}
