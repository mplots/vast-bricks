package com.vastbricks.api.reconciliation;

import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationOrderResult;
import com.vastbricks.api.reconciliation.rule.ReconciliationFailure;
import com.vastbricks.api.reconciliation.rule.Rule;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;

/**
 * Reconciles one month in three stages: the sources fetch every provider, the mappers build the single reconciled
 * order list out of what they fetched, and the rules judge each collected order. Adding a provider adds a source and a
 * mapper, adding a check adds a rule, and neither touches this orchestration.
 *
 * <p>A source and a mapper are joined by the class the source returns and the mapper reads. Neither names the other.
 */
@Service
class ReconciliationService {

    /**
     * The order the API returns: newest order first, an order with no date last. Orders sharing a date keep the order
     * the mappers collected them in, because the sort is stable.
     */
    private static final Comparator<ReconciledOrder> NEWEST_FIRST =
            Comparator.comparing(ReconciledOrder::getOrderDate, Comparator.nullsLast(Comparator.reverseOrder()));

    private final Map<Class<?>, Source<?>> sources;
    private final List<OrderMapper<?>> orderMappers;
    private final List<DetailMapper<?>> detailMappers;
    private final List<Rule> rules;

    ReconciliationService(
            List<Source<?>> sources,
            List<OrderMapper<?>> orderMappers,
            List<DetailMapper<?>> detailMappers,
            List<Rule> rules
    ) {
        this.sources = sourcesByType(sources);
        this.orderMappers = orderMappers;
        this.detailMappers = detailMappers;
        this.rules = rules;
    }

    List<ReconciliationOrderResult> findOrders(YearMonth month) {
        return reconcile(map(source(month)));
    }

    /** Sourcing: every provider is fetched, all of them in parallel. */
    private SourcedData source(YearMonth month) {
        try (var tasks = new ParallelTasks()) {
            // Every source starts before the first result is joined, so no provider waits for another.
            var fetches = new LinkedHashMap<Class<?>, Supplier<? extends List<?>>>();
            sources.forEach((type, source) -> fetches.put(type, tasks.start(() -> source.fetch(month))));

            var sourced = new LinkedHashMap<Class<?>, List<?>>();
            fetches.forEach((type, fetch) -> sourced.put(type, fetch.get()));
            return new SourcedData(sourced);
        }
    }

    /** Mapping: the order mappers collect the orders, then the detail mappers merge their data onto them. */
    private ReconciledOrders map(SourcedData sourced) {
        var orders = new ReconciledOrders();
        orderMappers.forEach(mapper -> collect(mapper, sourced, orders));
        detailMappers.forEach(mapper -> merge(mapper, sourced, orders));
        return orders;
    }

    /** Rules: every rule judges every collected order, and the judged orders are returned newest first. */
    private List<ReconciliationOrderResult> reconcile(ReconciledOrders orders) {
        return orders.all().stream()
                .sorted(NEWEST_FIRST)
                .map(order -> new ReconciliationOrderResult(order, evaluate(order)))
                .toList();
    }

    private <T> void collect(OrderMapper<T> mapper, SourcedData sourced, ReconciledOrders orders) {
        orders.addAll(mapper.map(sourced.of(mapper.type())));
    }

    private <T> void merge(DetailMapper<T> mapper, SourcedData sourced, ReconciledOrders orders) {
        mapper.map(sourced.of(mapper.type()), orders);
    }

    private List<ReconciliationFailure> evaluate(ReconciledOrder order) {
        return rules.stream()
                .flatMap(rule -> rule.evaluate(order).stream())
                .toList();
    }

    /**
     * Indexes the sources by the class each returns. A class is the whole glue between a source and its mappers, so an
     * ambiguous one is a wiring mistake and fails the application start rather than a request.
     */
    private static Map<Class<?>, Source<?>> sourcesByType(List<Source<?>> sources) {
        var byType = new LinkedHashMap<Class<?>, Source<?>>();
        for (var source : sources) {
            var claimed = byType.putIfAbsent(source.type(), source);
            if (claimed != null) {
                throw new IllegalStateException(
                        "Sources %s and %s both return %s: a sourced class must have exactly one source".formatted(
                                claimed.getClass().getSimpleName(),
                                source.getClass().getSimpleName(),
                                source.type().getSimpleName()
                        )
                );
            }
        }
        return byType;
    }
}
