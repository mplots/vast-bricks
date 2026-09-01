package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
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

        try (var tasks = new ParallelTasks()) {
            var fullNameOrders = tasks.start(() -> brickStoreClient.listOrders(fullNameRequest));
            var usernameOrders = tasks.start(() -> brickStoreClient.listOrders(usernameRequest));
            return toReconciliationOrders(fullNameOrders.get(), usernameOrders.get());
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
                orderId == null ? null : usernamesByOrderId.get(orderId),
                ReconciliationAmount.normalize(order.getTotal()),
                ReconciliationAmount.normalize(sumItemPrices(order))
        );
    }

    private BigDecimal sumItemPrices(BrickStoreOrder order) {
        if (order.getItems() == null) {
            return null;
        }
        return order.getItems().stream()
                .filter(item -> item.getPrice() != null && item.getQuantity() != null)
                .map(item -> item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
