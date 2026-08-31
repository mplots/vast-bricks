package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import java.time.YearMonth;
import java.util.Map;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.Executors;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class BrickLinkOrderSource implements ReconciliationOrderSource {

    private static final String SOURCE = "BrickLink";

    private final BrickStoreClient brickStoreClient;

    @Override
    public List<ReconciliationOrder> findOrders(YearMonth month) {
        var fullNameRequest = BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                month.atDay(1),
                month.atEndOfMonth(),
                true
        );
        var usernameRequest = BrickStoreOrderExportRequest.forDateRange(
                BrickStoreOrderType.RECEIVED,
                month.atDay(1),
                month.atEndOfMonth(),
                false
        );

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var fullNameOrders = CompletableFuture.supplyAsync(() -> brickStoreClient.listOrders(fullNameRequest), executor);
            var usernameOrders = CompletableFuture.supplyAsync(() -> brickStoreClient.listOrders(usernameRequest), executor);
            return toReconciliationOrders(await(fullNameOrders), await(usernameOrders));
        }
    }

    private List<ReconciliationOrder> toReconciliationOrders(
            List<BrickStoreOrder> fullNameOrders,
            List<BrickStoreOrder> usernameOrders
    ) {
        var usernamesByOrderId = usernameOrders.stream()
                .filter(order -> order.getOrderId() != null)
                .collect(Collectors.toMap(
                        order -> order.getOrderId().toString(),
                        BrickStoreOrder::getBuyer
                ));

        return fullNameOrders.stream()
                .map(order -> toReconciliationOrder(order, usernamesByOrderId))
                .toList();
    }

    private ReconciliationOrder toReconciliationOrder(BrickStoreOrder order, Map<String, String> usernamesByOrderId) {
        var orderId = order.getOrderId() == null ? null : order.getOrderId().toString();
        return new ReconciliationOrder(
                SOURCE,
                orderId,
                order.getBuyer(),
                orderId == null ? null : usernamesByOrderId.get(orderId)
        );
    }

    private <T> T await(CompletableFuture<T> future) {
        try {
            return future.join();
        } catch (CompletionException exception) {
            if (exception.getCause() instanceof RuntimeException runtimeException) {
                throw runtimeException;
            }
            throw exception;
        }
    }
}
