package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.type.TypeReference;
import java.math.BigDecimal;
import java.time.DateTimeException;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/brickowl", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class BrickOwlController {

    private final BrickOwlClient brickOwlClient;

    @GetMapping("/orders")
    public List<OrderSummaryResponse> findOrders(@RequestParam("month") String month) {
        var requestedMonth = parseMonth(month);
        var orderIds = brickOwlClient.listOrders().stream()
                .filter(order -> order.getOrderDate() != null && YearMonth.from(order.getOrderDate()).equals(requestedMonth))
                .map(BrickOwlOrderListItem::getOrderId)
                .toList();

        var result = new ArrayList<OrderSummaryResponse>();
        for (var start = 0; start < orderIds.size(); start += BrickOwlClient.MAX_BATCH_REQUESTS) {
            var batchOrderIds = orderIds.subList(start, Math.min(start + BrickOwlClient.MAX_BATCH_REQUESTS, orderIds.size()));
            appendOrderSummaries(
                    result,
                    executeBatch(batchOrderIds, "order/view"),
                    executeBatch(batchOrderIds, "order/items")
            );
        }
        return List.copyOf(result);
    }

    private YearMonth parseMonth(String value) {
        try {
            return YearMonth.parse(value);
        } catch (DateTimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must use YYYY-MM format", ex);
        }
    }

    private List<BrickOwlBatchResponse> executeBatch(List<String> orderIds, String endpoint) {
        var requests = orderIds.stream()
                .map(orderId -> BrickOwlBatchRequest.get(endpoint, Map.of("order_id", orderId)))
                .toList();
        return brickOwlClient.executeBatch(requests);
    }

    private void appendOrderSummaries(
            List<OrderSummaryResponse> result,
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
            result.add(new OrderSummaryResponse(
                    order.getOrderId(),
                    order.getBuyerName(),
                    order.getCustomerUsername(),
                    sumItemBasePrices(itemResponses.get(index)),
                    order.getSubTotal()
            ));
        }
    }

    private BigDecimal sumItemBasePrices(BrickOwlBatchResponse batchResponse) {
        validateBatchResponse(batchResponse);
        return batchResponse.bodyAs(new TypeReference<List<OrderItem>>() {}).stream()
                .filter(item -> item.getBasePrice() != null && item.getOrderedQuantity() != null)
                .map(item -> item.getBasePrice().multiply(item.getOrderedQuantity()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void validateBatchResponse(BrickOwlBatchResponse batchResponse) {
        if (batchResponse.getCode() == null || batchResponse.getCode() != 200) {
            throw new BrickOwlClientException("BrickOwl batch request failed");
        }
    }

    @Data
    @AllArgsConstructor
    public static class OrderSummaryResponse {
        private String orderId;
        private String name;
        private String username;
        private BigDecimal basePrice;
        private BigDecimal subTotal;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    private static class OrderItem {
        @JsonProperty("base_price")
        private BigDecimal basePrice;

        @JsonProperty("ordered_quantity")
        private BigDecimal orderedQuantity;
    }
}
