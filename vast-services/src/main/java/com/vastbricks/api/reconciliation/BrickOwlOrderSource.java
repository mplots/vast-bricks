package com.vastbricks.api.reconciliation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.vastbricks.api.client.brickowl.BrickOwlBatchRequest;
import com.vastbricks.api.client.brickowl.BrickOwlBatchResponse;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import com.vastbricks.api.client.brickowl.BrickOwlOrderItem;
import com.vastbricks.api.client.brickowl.BrickOwlOrderListItem;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2)
@RequiredArgsConstructor
class BrickOwlOrderSource implements ReconciliationOrderSource {

    private static final String ORDER_ENDPOINT = "order/view";
    private static final String ITEMS_ENDPOINT = "order/items";

    private final BrickOwlClient brickOwlClient;

    @Override
    public List<ReconciliationOrder> findOrders(YearMonth month) {
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

            var orders = new ArrayList<ReconciliationOrder>();
            for (var index = 0; index < orderBatches.size(); index++) {
                appendReconciliationOrders(
                        orders,
                        orderDates,
                        orderBatches.get(index).get(),
                        itemBatches.get(index).get()
                );
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

    private void appendReconciliationOrders(
            List<ReconciliationOrder> result,
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
            result.add(ReconciliationOrder.builder()
                    .source(ReconciliationSource.BRICK_OWL)
                    .orderId(order.getOrderId())
                    .orderDate(orderDates.get(order.getOrderId()))
                    .buyer(order.getBuyerName())
                    .buyerUsername(order.getCustomerUsername())
                    .subTotal(ReconciliationAmount.normalize(order.getSubTotal()))
                    .itemsSubTotal(ReconciliationAmount.normalize(sumItemBasePrices(itemResponses.get(index))))
                    .build());
        }
    }

    private BigDecimal sumItemBasePrices(BrickOwlBatchResponse batchResponse) {
        validateBatchResponse(batchResponse);
        return batchResponse.bodyAs(new TypeReference<List<BrickOwlOrderItem>>() {}).stream()
                .filter(item -> item.getBasePrice() != null && item.getOrderedQuantity() != null)
                .map(item -> item.getBasePrice().multiply(item.getOrderedQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validateBatchResponse(BrickOwlBatchResponse batchResponse) {
        if (batchResponse.getCode() == null || batchResponse.getCode() != 200) {
            throw new BrickOwlClientException("BrickOwl batch request failed");
        }
    }
}
