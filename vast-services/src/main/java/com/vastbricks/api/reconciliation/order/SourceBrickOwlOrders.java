package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.ParallelTasks;
import com.vastbricks.api.reconciliation.Source;
import com.vastbricks.api.client.brickowl.BrickOwlBatchRequest;
import com.vastbricks.api.client.brickowl.BrickOwlBatchResponse;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickowl.BrickOwlOrderListItem;
import java.time.LocalDate;
import com.vastbricks.api.reconciliation.ReconciliationPeriod;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches BrickOwl orders in the selected date range. The list endpoint cannot be filtered and carries no amounts,
 * so the source filters the dates and each order's detail is requested in batches; every batch starts before the first is
 * joined. Pairing the batch responses back onto their requests is BrickOwl's batch protocol, so it happens here
 * rather than in the mapper.
 */
@Component
@RequiredArgsConstructor
class SourceBrickOwlOrders implements Source<SourcedBrickOwlOrder> {

    private static final String ORDER_ENDPOINT = "order/view";

    private final BrickOwlClient brickOwlClient;

    @Override
    public Class<SourcedBrickOwlOrder> type() {
        return SourcedBrickOwlOrder.class;
    }

    @Override
    public List<SourcedBrickOwlOrder> fetch(ReconciliationPeriod period) {
        var listedOrders = findListedOrders(period);
        if (listedOrders.isEmpty()) {
            return List.of();
        }
        // The order list is the only response that always carries the order date, so it is carried into the details.
        var orderDates = listedOrders.stream().collect(Collectors.toMap(
                BrickOwlOrderListItem::getOrderId,
                order -> order.getOrderDate().toLocalDate()
        ));
        var orderIds = listedOrders.stream().map(BrickOwlOrderListItem::getOrderId).toList();

        try (var tasks = new ParallelTasks()) {
            var orderBatches = new ArrayList<Supplier<List<BrickOwlBatchResponse>>>();
            for (var batchOrderIds : partition(orderIds)) {
                orderBatches.add(tasks.start(() -> executeBatch(batchOrderIds)));
            }

            var orders = new ArrayList<SourcedBrickOwlOrder>();
            for (var orderBatch : orderBatches) {
                appendSourcedOrders(orders, orderDates, orderBatch.get());
            }
            return List.copyOf(orders);
        }
    }

    private List<BrickOwlOrderListItem> findListedOrders(ReconciliationPeriod period) {
        return brickOwlClient.listOrders().stream()
                .filter(order -> order.getOrderDate() != null && period.contains(order.getOrderDate().toLocalDate()))
                .toList();
    }

    private List<List<String>> partition(List<String> orderIds) {
        var batches = new ArrayList<List<String>>();
        for (var start = 0; start < orderIds.size(); start += BrickOwlClient.MAX_BATCH_REQUESTS) {
            var end = Math.min(start + BrickOwlClient.MAX_BATCH_REQUESTS, orderIds.size());
            batches.add(List.copyOf(orderIds.subList(start, end)));
        }
        return batches;
    }

    private List<BrickOwlBatchResponse> executeBatch(List<String> orderIds) {
        var requests = orderIds.stream()
                .map(orderId -> BrickOwlBatchRequest.get(ORDER_ENDPOINT, Map.of("order_id", orderId)))
                .toList();
        return brickOwlClient.executeBatch(requests);
    }

    private void appendSourcedOrders(
            List<SourcedBrickOwlOrder> result,
            Map<String, LocalDate> orderDates,
            List<BrickOwlBatchResponse> orderResponses
    ) {
        for (var orderResponse : orderResponses) {
            validateBatchResponse(orderResponse);
            var order = orderResponse.bodyAs(BrickOwlOrder.class);
            result.add(new SourcedBrickOwlOrder(order, orderDates.get(order.getOrderId())));
        }
    }

    private void validateBatchResponse(BrickOwlBatchResponse batchResponse) {
        if (batchResponse.getCode() == null || batchResponse.getCode() != 200) {
            throw new BrickOwlClientException("BrickOwl batch request failed");
        }
    }
}
