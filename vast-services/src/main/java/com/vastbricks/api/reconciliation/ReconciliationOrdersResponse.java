package com.vastbricks.api.reconciliation;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
class ReconciliationOrdersResponse {

    private final String selectedMonth;
    private final List<ReconciliationOrderResult> orders;
}
