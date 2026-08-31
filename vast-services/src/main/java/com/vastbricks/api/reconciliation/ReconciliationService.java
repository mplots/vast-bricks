package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class ReconciliationService {

    private final List<ReconciliationOrderSource> orderSources;

    List<ReconciliationOrder> findOrders(YearMonth month) {
        return orderSources.stream()
                .flatMap(source -> source.findOrders(month).stream())
                .toList();
    }
}
