package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;

public interface ReconciliationOrderSource {

    List<ReconciliationOrder> findOrders(YearMonth month);
}
