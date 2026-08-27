package com.vastbricks.accounting;

import com.vastbricks.config.Env;
import com.vastbricks.integration.bricklink.LinkInternalClient;
import com.vastbricks.integration.bricklink.OrderExportRequest;
import com.vastbricks.integration.bricklink.OrderType;
import com.vastbricks.market.owl.BatchRequest;
import com.vastbricks.market.owl.BatchResponse;
import com.vastbricks.market.owl.OrderListItem;
import com.vastbricks.market.owl.OrderView;
import com.vastbricks.market.owl.OwlClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Supplier;

@Service
public class AccountingService {
    private static final int BATCH_SIZE = 50;

    private final LinkInternalClient linkInternalClient;
    private final Supplier<List<OrderListItem>> owlOrderList;
    private final Function<List<BatchRequest>, List<BatchResponse>> owlBatch;

    @Autowired
    public AccountingService(LinkInternalClient linkInternalClient, Env env) {
        this.linkInternalClient = linkInternalClient;
        var owlClient = new OwlClient(env.getBrickOwlApiKey(), env.getBrickOwlCookie());
        this.owlOrderList = () -> owlClient.order().list();
        this.owlBatch = requests -> owlClient.batch().execute(requests);
    }

    AccountingService(
            LinkInternalClient linkInternalClient,
            Supplier<List<OrderListItem>> owlOrderList,
            Function<List<BatchRequest>, List<BatchResponse>> owlBatch
    ) {
        this.linkInternalClient = linkInternalClient;
        this.owlOrderList = owlOrderList;
        this.owlBatch = owlBatch;
    }

    public List<AccountingOrder> findOrders(YearMonth month) {
        var orders = new ArrayList<AccountingOrder>();
        orders.addAll(findBrickLinkOrders(month));
        orders.addAll(findBrickOwlOrders(month));
        orders.sort(Comparator
                .comparing(AccountingOrder::getOrderDate, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(AccountingOrder::getOrderNumber, Comparator.reverseOrder()));
        return orders;
    }

    public List<AccountingOrder> findBrickLinkOrders(YearMonth month) {
        var request = OrderExportRequest.forDateRange(
                OrderType.RECEIVED,
                month.atDay(1),
                month.atEndOfMonth()
        );
        return linkInternalClient.listOrders(request).stream()
                .filter(order -> order.getOrderDate() != null)
                .filter(order -> YearMonth.from(order.getOrderDate()).equals(month))
                .map(order -> new AccountingOrder(
                        "BrickLink",
                        order.getOrderDate(),
                        order.getOrderId().toString(),
                        order.getBuyer(),
                        order.getTotalLots(),
                        order.getTotalItems(),
                        add(order.getTotal(), order.getAdditionalCharge1()),
                        order.getVatCharges(),
                        country(order.getLocation()),
                        add(order.getShipping(), order.getAdditionalCharge2()),
                        add(order.getSalesTax(), order.getVat()),
                        order.getBaseGrandTotal(),
                        paymentSource(order.getPaymentType()),
                        null,
                        null,
                        order.getPaymentCurrencyCode(),
                        null,
                        null,
                        null
                ))
                .toList();
    }

    private List<AccountingOrder> findBrickOwlOrders(YearMonth month) {
        var listedOrders = owlOrderList.get();
        if (listedOrders == null || listedOrders.isEmpty()) {
            return List.of();
        }
        var relevantOrders = listedOrders.stream()
                .filter(order -> order.getOrderId() != null && order.getOrderDate() != null)
                .filter(order -> YearMonth.from(order.getOrderDate()).equals(month))
                .toList();

        var orders = new ArrayList<AccountingOrder>();
        for (var offset = 0; offset < relevantOrders.size(); offset += BATCH_SIZE) {
            var chunk = relevantOrders.subList(offset, Math.min(offset + BATCH_SIZE, relevantOrders.size()));
            var requests = chunk.stream()
                    .map(order -> BatchRequest.get("order/view", Map.of("order_id", order.getOrderId())))
                    .toList();
            var responses = owlBatch.apply(requests);
            if (responses == null) {
                continue;
            }
            responses.stream()
                    .filter(response -> response.getCode() != null)
                    .filter(response -> response.getCode() >= 200 && response.getCode() < 300)
                    .filter(response -> response.getBody() != null)
                    .map(response -> response.bodyAs(OrderView.class))
                    .filter(order -> order.getOrderId() != null)
                    .map(order -> new AccountingOrder(
                            "Brick Owl",
                            orderDate(order.getIsoOrderTime(), order.getOrderTime()),
                            order.getOrderId(),
                            order.getBuyerName(),
                            order.getTotalLots(),
                            order.getTotalQuantity(),
                            order.getSubTotal(),
                            order.getTaxSchemeId() == null ? order.getTaxAmount() : BigDecimal.ZERO,
                            country(order.getShipCountry()),
                            order.getShipping(),
                            order.getTaxSchemeId() != null ? order.getTaxAmount() : BigDecimal.ZERO,
                            order.getBaseOrderTotal(),
                            paymentSource(order.getPaymentMethodType()),
                            null,
                            order.getPaymentTransactionId(),
                            order.getPaymentCurrency(),
                            null,
                            null,
                            null
                    ))
                    .forEach(orders::add);
        }
        return orders;
    }

    private String paymentSource(String paymentMethod) {
        if (paymentMethod == null || paymentMethod.isBlank()) {
            return null;
        }
        var normalized = paymentMethod.trim();
        if (normalized.toLowerCase().contains("paypal")) {
            return "PayPal";
        }
        if (normalized.toLowerCase().contains("stripe")) {
            return "Stripe";
        }
        return normalized;
    }

    private LocalDate orderDate(LocalDateTime isoOrderTime, LocalDateTime orderTime) {
        var dateTime = isoOrderTime != null ? isoOrderTime : orderTime;
        return dateTime == null ? null : dateTime.toLocalDate();
    }

    private String country(String location) {
        if (location == null || location.isBlank()) {
            return null;
        }
        var separator = location.indexOf(',');
        var country = separator < 0 ? location : location.substring(0, separator);
        return country.trim().isEmpty() ? null : country.trim();
    }

    private BigDecimal add(BigDecimal first, BigDecimal second) {
        if (first == null && second == null) {
            return null;
        }
        return (first == null ? BigDecimal.ZERO : first)
                .add(second == null ? BigDecimal.ZERO : second);
    }
}
