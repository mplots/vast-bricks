package com.vastbricks.api.invoice;

import com.vastbricks.api.client.brickowl.BrickOwlBatchRequest;
import com.vastbricks.api.client.brickowl.BrickOwlBatchResponse;
import com.vastbricks.api.client.brickowl.BrickOwlClient;
import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickowl.BrickOwlOrder;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Looks a BrickOwl order up through the batch endpoint, which is the only way this client talks to the order API.
 */
@Component
@RequiredArgsConstructor
class BrickOwlInvoiceOrderSource implements InvoiceOrderSource {

    private static final String ORDER_ENDPOINT = "order/view";

    private final BrickOwlClient brickOwlClient;

    @Override
    public InvoiceOrderMarketplace marketplace() {
        return InvoiceOrderMarketplace.BRICK_OWL;
    }

    @Override
    public InvoiceOrder findOrder(String orderId) {
        var order = requestOrder(InvoiceOrderText.required(orderId, "orderId is required"));
        var customerId = InvoiceOrderText.required(
                InvoiceOrderText.firstNotBlank(order.getCustomerUserId(), order.getCustomerUsername()),
                "BrickOwl order has no customer identifier"
        );
        var name = InvoiceOrderText.required(
                InvoiceOrderText.firstNotBlank(
                        InvoiceOrderText.fullName(order.getBillingFirstName(), order.getBillingLastName()),
                        InvoiceOrderText.fullName(order.getShipFirstName(), order.getShipLastName()),
                        order.getBuyerName(),
                        order.getCustomerUsername()
                ),
                "BrickOwl order has no customer name"
        );
        var orderTime = order.getIsoOrderTime() != null ? order.getIsoOrderTime() : order.getOrderTime();
        if (orderTime == null) {
            throw new InvoiceException("BrickOwl order has no order date");
        }
        if (order.getSubTotal() == null) {
            throw new InvoiceException("BrickOwl order has no sub-total");
        }
        return new InvoiceOrder(
                marketplace().key() + ":customer:" + customerId,
                name,
                orderTime.toLocalDate(),
                order.getSubTotal()
        );
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
            throw new InvoiceException("BrickOwl order not found: " + orderId);
        }
        var order = response.bodyAs(BrickOwlOrder.class);
        if (order == null) {
            throw new InvoiceException("BrickOwl order not found: " + orderId);
        }
        return order;
    }
}
