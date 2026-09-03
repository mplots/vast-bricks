package com.vastbricks.api.orderfinancials;

import com.vastbricks.api.client.brickowl.BrickOwlBatchRequest;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Reads a BrickOwl order through the batch endpoint, which is the only way this client talks to the order API. */
@Component
@RequiredArgsConstructor
class BrickOwlOrderFinancialsSource implements OrderFinancialsSource {

    private static final String ORDER_ENDPOINT = "order/view";

    private final BrickOwlClient brickOwlClient;

    @Override
    public OrderFinancialsMarketplace marketplace() {
        return OrderFinancialsMarketplace.BRICK_OWL;
    }

    @Override
    public ReportedOrderFinancials findFinancials(String orderId) {
        var order = requestOrder(orderId);
        return ReportedOrderFinancials.builder()
                .baseOrderTotal(order.getBaseOrderTotal())
                .taxRate(order.getTaxRate())
                .build();
    }

    private BrickOwlOrder requestOrder(String orderId) {
        var responses = brickOwlClient.executeBatch(List.of(
                BrickOwlBatchRequest.get(ORDER_ENDPOINT, Map.of("order_id", orderId))
        ));
        if (responses == null || responses.isEmpty()) {
            throw new BrickOwlClientException("BrickOwl returned no order data");
        }
        var response = responses.getFirst();
        if (response.getCode() == null || response.getCode() != 200) {
            throw new OrderFinancialsException("BrickOwl order not found: " + orderId);
        }
        var order = response.bodyAs(BrickOwlOrder.class);
        if (order == null) {
            throw new OrderFinancialsException("BrickOwl order not found: " + orderId);
        }
        return order;
    }
}
