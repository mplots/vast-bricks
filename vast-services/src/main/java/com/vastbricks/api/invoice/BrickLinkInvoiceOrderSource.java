package com.vastbricks.api.invoice;

import com.vastbricks.api.client.brickstore.BrickStoreClient;
import com.vastbricks.api.client.brickstore.BrickStoreOrder;
import com.vastbricks.api.client.brickstore.BrickStoreOrderExportRequest;
import com.vastbricks.api.client.brickstore.BrickStoreOrderType;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Looks a BrickLink order up through the BrickStore order export. The export names the buyer either by real name or
 * by username, so it is requested both ways: the invoice is issued to the real name while the buyer is identified
 * across orders by the stable username.
 */
@Component
@RequiredArgsConstructor
class BrickLinkInvoiceOrderSource implements InvoiceOrderSource {

    private final BrickStoreClient brickStoreClient;

    @Override
    public InvoiceOrderMarketplace marketplace() {
        return InvoiceOrderMarketplace.BRICK_LINK;
    }

    @Override
    public InvoiceOrder findOrder(String orderId) {
        var numericOrderId = numericOrderId(orderId);
        var fullNameOrder = findExportedOrder(numericOrderId, true);
        var usernameOrder = findExportedOrder(numericOrderId, false);

        var username = InvoiceOrderText.required(
                usernameOrder.getBuyer(),
                "BrickLink order has no buyer identifier"
        );
        var name = InvoiceOrderText.firstNotBlank(fullNameOrder.getBuyer(), username);
        if (fullNameOrder.getOrderDate() == null) {
            throw new InvoiceException("BrickLink order has no order date");
        }
        if (fullNameOrder.getTotal() == null) {
            throw new InvoiceException("BrickLink order has no sub-total");
        }
        return new InvoiceOrder(
                marketplace().key() + ":customer:" + username,
                name,
                fullNameOrder.getOrderDate(),
                fullNameOrder.getTotal()
        );
    }

    private BrickStoreOrder findExportedOrder(String orderId, boolean useRealName) {
        var orders = brickStoreClient.listOrders(
                BrickStoreOrderExportRequest.forOrderId(BrickStoreOrderType.RECEIVED, orderId, useRealName)
        );
        return matchingOrder(orders, orderId);
    }

    private BrickStoreOrder matchingOrder(List<BrickStoreOrder> orders, String orderId) {
        return orders.stream()
                .filter(order -> order.getOrderId() != null && orderId.equals(order.getOrderId().toString()))
                .findFirst()
                .orElseThrow(() -> new InvoiceException("BrickLink order not found: " + orderId));
    }

    private String numericOrderId(String orderId) {
        var normalized = InvoiceOrderText.required(orderId, "orderId is required");
        try {
            return Long.toString(Long.parseLong(normalized));
        } catch (NumberFormatException ex) {
            throw new InvoiceException("BrickLink orderId must be numeric", ex);
        }
    }
}
