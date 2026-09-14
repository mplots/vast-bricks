package com.vastbricks.api.order;

import com.vastbricks.api.orderarchive.OrderSource;
import com.vastbricks.api.tax.OrderTaxType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Every response body of the orders feature. */
final class OrderPayload {

    private OrderPayload() {
    }

    @Getter
    @AllArgsConstructor
    static final class OrdersResponse {

        /** The range the orders were read for, as the screen asked for it, so a reply can be told from a stale one. */
        private final String from;

        private final String to;

        private final List<OrderResponse> orders;
    }

    /**
     * An order as the screen reads it.
     *
     * <p>Every field the reconciliation report states about an order itself, under the same names, so the two
     * screens can be read against each other without a reader translating between them. What is not here is what
     * the other sources report on an order - the payment gateway, the post office, the accounting invoice - which
     * reconciliation collects live and stores nowhere.
     *
     * <p>The source is its code rather than a name: the wording of a marketplace belongs in the portal catalogs, as
     * the wording of a job's tally and of a reconciliation failure does.
     */
    @Getter
    @AllArgsConstructor
    static final class OrderResponse {

        private final Long id;

        private final OrderSource source;

        private final String orderId;

        /** Where the marketplace shows the order, which the screen hangs on the order id. */
        private final String orderUrl;

        private final Instant orderDate;

        /** The buyer's own name. */
        private final String buyer;

        /** The buyer's account with the marketplace, which is a different fact from their name. */
        private final String buyerUsername;

        private final Integer itemCount;

        private final Integer lotCount;

        /** How the order was paid, unified across the marketplaces' wordings. */
        private final String paymentMethod;

        /** What the buyer paid in. The grand total is in the store's own base currency. */
        private final String currency;

        private final OrderTaxType taxType;

        /** What the marketplace collected as tax facilitator, or null where it collected none. */
        private final BigDecimal facilitatorTax;

        private final BigDecimal subTotal;

        /** What the buyer was charged for shipping, not what the post office charged the store. */
        private final BigDecimal shippingCost;

        private final BigDecimal grandTotal;

        /** What the marketplace reports was refunded, or null where it reports none. */
        private final BigDecimal refundedAmount;

        /** When the archive this row was read from was taken, which is how current the row is. */
        private final Instant archivedAt;

        OrderResponse(Order order) {
            this(order.getId(), order.getSource(), order.getOrderId(), order.getOrderUrl(), order.getOrderDate(),
                    order.getBuyer(), order.getBuyerUsername(), order.getItemCount(), order.getLotCount(),
                    order.getPaymentMethod(), order.getCurrency(), order.getTaxType(), order.getFacilitatorTax(),
                    order.getSubTotal(), order.getShippingCost(), order.getGrandTotal(), order.getRefundedAmount(),
                    order.getArchivedAt());
        }
    }
}
