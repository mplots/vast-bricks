package com.vastbricks.api.reconciliation;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class ReconciliationService {

    private final List<ReconciliationOrderSource> orderSources;
    private final List<ReconciliationInvoiceSource> invoiceSources;
    private final List<ReconciliationRule> rules;

    List<ReconciliationOrderResult> findOrders(YearMonth month) {
        // Every source starts before the first result is joined, so all categories are requested concurrently.
        try (var tasks = new ParallelTasks()) {
            var sourceOrders = orderSources.stream()
                    .map(source -> tasks.start(() -> source.findOrders(month)))
                    .toList();
            var sourceInvoices = invoiceSources.stream()
                    .map(source -> tasks.start(() -> source.findInvoices(month)))
                    .toList();

            var invoices = collectInvoices(sourceInvoices);
            return collect(sourceOrders).stream()
                    .map(order -> withInvoice(order, invoices))
                    .map(this::reconcile)
                    .toList();
        }
    }

    private Map<String, ReconciliationInvoice> collectInvoices(
            List<Supplier<List<ReconciliationInvoice>>> sourceInvoices
    ) {
        return collect(sourceInvoices).stream().collect(Collectors.toMap(
                invoice -> invoiceKey(invoice.getSource(), invoice.getOrderId()),
                invoice -> invoice,
                (first, duplicate) -> first
        ));
    }

    private <T> List<T> collect(List<Supplier<List<T>>> sourceResults) {
        return sourceResults.stream()
                .flatMap(results -> results.get().stream())
                .toList();
    }

    private ReconciliationOrder withInvoice(ReconciliationOrder order, Map<String, ReconciliationInvoice> invoices) {
        var invoice = invoices.get(invoiceKey(order.getSource(), order.getOrderId()));
        if (invoice == null) {
            return order;
        }
        return order.toBuilder().invoiceSubTotal(invoice.getSubTotal()).build();
    }

    private String invoiceKey(String source, String orderId) {
        return source + '/' + orderId;
    }

    private ReconciliationOrderResult reconcile(ReconciliationOrder order) {
        var failures = rules.stream()
                .flatMap(rule -> rule.evaluate(order).stream())
                .toList();
        return new ReconciliationOrderResult(order, failures);
    }
}
