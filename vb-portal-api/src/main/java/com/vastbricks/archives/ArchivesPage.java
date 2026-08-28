package com.vastbricks.archives;

import com.vastbricks.accounting.AccountingSummary;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ArchivesPage {
    private String selectedMonth;
    private List<ArchiveOrder> orders;
    private AccountingSummary summary;
}
