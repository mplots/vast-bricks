package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.reconciliation.ParallelTasks;
import com.vastbricks.api.reconciliation.Source;
import com.fasterxml.jackson.core.type.TypeReference;
import com.vastbricks.api.client.brickowl.BrickOwlBatchRequest;
import com.vastbricks.api.client.brickowl.BrickOwlBatchResponse;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickowl.BrickOwlOrderItem;
import com.vastbricks.api.client.brickowl.BrickOwlOrderListItem;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Fetches the BrickOwl orders of the month. The list endpoint cannot be filtered and carries no amounts, so the month
 * is filtered client-side and each order's detail and items are requested in batches; every batch starts before the
 * first is joined. Pairing the batch responses back onto their requests is BrickOwl's batch protocol, so it happens
 * here rather than in the mapper.
 */
@Component
@RequiredArgsConstructor
class SourceBrickOwlOrders implements Source<SourcedBrickOwlOrder> {

    private static final String ORDER_ENDPOINT = "order/view";
    private static final String ITEMS_ENDPOINT = "order/items";

    private final BrickOwlClient brickOwlClient;

    @Override
    public Class<SourcedBrickOwlOrder> type() {
        return SourcedBrickOwlOrder.class;
    }

    @Override
    public List<SourcedBrickOwlOrder> fetch(YearMonth month) {
        var listedOrders = findListedOrders(month);
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
            var itemBatches = new ArrayList<Supplier<List<BrickOwlBatchResponse>>>();
            for (var batchOrderIds : partition(orderIds)) {
                orderBatches.add(tasks.start(() -> executeBatch(batchOrderIds, ORDER_ENDPOINT)));
                itemBatches.add(tasks.start(() -> executeBatch(batchOrderIds, ITEMS_ENDPOINT)));
            }

            var orders = new ArrayList<SourcedBrickOwlOrder>();
            for (var index = 0; index < orderBatches.size(); index++) {
                appendSourcedOrders(orders, orderDates, orderBatches.get(index).get(), itemBatches.get(index).get());
            }
            return List.copyOf(orders);
        }
    }

    private List<BrickOwlOrderListItem> findListedOrders(YearMonth month) {
        return brickOwlClient.listOrders().stream()
                .filter(order -> order.getOrderDate() != null && YearMonth.from(order.getOrderDate()).equals(month))
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

    private List<BrickOwlBatchResponse> executeBatch(List<String> orderIds, String endpoint) {
        var requests = orderIds.stream()
                .map(orderId -> BrickOwlBatchRequest.get(endpoint, Map.of("order_id", orderId)))
                .toList();
        return brickOwlClient.executeBatch(requests);
    }

    private void appendSourcedOrders(
            List<SourcedBrickOwlOrder> result,
            Map<String, LocalDate> orderDates,
            List<BrickOwlBatchResponse> orderResponses,
            List<BrickOwlBatchResponse> itemResponses
    ) {
        if (orderResponses.size() != itemResponses.size()) {
            throw new BrickOwlClientException("BrickOwl batch response count does not match the request count");
        }
        for (var index = 0; index < orderResponses.size(); index++) {
            var orderResponse = orderResponses.get(index);
            validateBatchResponse(orderResponse);
            var order = orderResponse.bodyAs(BrickOwlOrder.class);
            result.add(new SourcedBrickOwlOrder(
                    order,
                    items(itemResponses.get(index)),
                    orderDates.get(order.getOrderId())
            ));
        }
    }

    private List<BrickOwlOrderItem> items(BrickOwlBatchResponse batchResponse) {
        validateBatchResponse(batchResponse);
        return batchResponse.bodyAs(new TypeReference<List<BrickOwlOrderItem>>() {});
    }

    private void validateBatchResponse(BrickOwlBatchResponse batchResponse) {
        if (batchResponse.getCode() == null || batchResponse.getCode() != 200) {
            throw new BrickOwlClientException("BrickOwl batch request failed");
        }
    }
}
