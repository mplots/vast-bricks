package com.vastbricks.api.orderfinancials;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
class OrderFinancialsService {

    private final List<OrderFinancialsSource> sources;

    OrderFinancialsResponse findFinancials(String orderId, String source) {
        var marketplace = OrderFinancialsMarketplace.of(source);
        var requestedOrderId = requiredOrderId(orderId);
        var reported = sourceFor(marketplace).findFinancials(requestedOrderId);
        return new OrderFinancialsResponse(
                marketplace.label(),
                requestedOrderId,
                reported,
                CalculatedOrderFinancials.of(reported)
        );
    }

    private OrderFinancialsSource sourceFor(OrderFinancialsMarketplace marketplace) {
        return sources.stream()
                .filter(source -> source.marketplace() == marketplace)
                .findFirst()
                .orElseThrow(() -> new OrderFinancialsException("Unsupported order source: " + marketplace.label()));
    }

    private String requiredOrderId(String orderId) {
        if (orderId == null || orderId.isBlank()) {
            throw new OrderFinancialsException("orderId is required");
        }
        return orderId.trim();
    }
}
