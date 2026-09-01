package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class ReconciliationService {

    private final List<ReconciliationOrderSource> orderSources;
    private final List<ReconciliationRule> rules;

    List<ReconciliationOrderResult> findOrders(YearMonth month) {
        return collectOrders(month).stream()
                .map(this::reconcile)
                .toList();
    }

    private List<ReconciliationOrder> collectOrders(YearMonth month) {
        try (var tasks = new ParallelTasks()) {
            var sourceOrders = orderSources.stream()
                    .map(source -> tasks.start(() -> source.findOrders(month)))
                    .toList();
            return sourceOrders.stream()
                    .flatMap(orders -> orders.get().stream())
                    .toList();
        }
    }

    private ReconciliationOrderResult reconcile(ReconciliationOrder order) {
        var failures = rules.stream()
                .flatMap(rule -> rule.evaluate(order).stream())
                .toList();
        return new ReconciliationOrderResult(order, failures);
    }
}
