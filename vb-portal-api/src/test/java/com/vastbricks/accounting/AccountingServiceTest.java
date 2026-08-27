package com.vastbricks.accounting;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.integration.bricklink.LinkInternalClient;
import com.vastbricks.integration.bricklink.LinkOrderSummary;
import com.vastbricks.integration.bricklink.OrderExportRequest;
import com.vastbricks.market.owl.BatchRequest;
import com.vastbricks.market.owl.BatchResponse;
import com.vastbricks.market.owl.OrderListItem;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AccountingServiceTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void combinesMonthlyOrdersFromBothMarketplaces() {
        var brickLinkOrder = brickLinkOrder();
        var listedOwlOrders = List.of(
                owlListItem("3060526", LocalDateTime.of(2026, 8, 6, 3, 0)),
                owlListItem("tax-scheme", LocalDateTime.of(2026, 8, 6, 4, 0)),
                owlListItem("outside-month", LocalDateTime.of(2026, 7, 31, 23, 59))
        );
        var batchSizes = new ArrayList<Integer>();
        var service = new AccountingService(
                new StubLinkInternalClient(List.of(brickLinkOrder)),
                () -> listedOwlOrders,
                requests -> {
                    batchSizes.add(requests.size());
                    return responses(requests);
                }
        );

        var orders = service.findOrders(YearMonth.of(2026, 8));

        var owlOrder = order(orders, "3060526");
        var owlTaxSchemeOrder = order(orders, "tax-scheme");
        var linkOrder = order(orders, "32266548");

        assertEquals(3, orders.size());
        assertEquals("Brick Owl", owlOrder.getSource());
        assertEquals(LocalDate.of(2026, 8, 6), owlOrder.getOrderDate());
        assertEquals("Owl Buyer", owlOrder.getBuyerName());
        assertEquals(4, owlOrder.getLotCount());
        assertEquals(5, owlOrder.getItemCount());
        assertEquals(new BigDecimal("4.28"), owlOrder.getOrderTotal());
        assertEquals(new BigDecimal("4.53"), owlOrder.getShipping());
        assertEquals(new BigDecimal("8.81"), owlOrder.getGrandTotal());
        assertEquals(new BigDecimal("8.81"), owlOrder.getCalculatedGrandTotal());
        assertFalse(owlOrder.isGrandTotalMismatch());
        assertEquals(new BigDecimal("1.66"), owlOrder.getVat());
        assertEquals("Germany", owlOrder.getLocation());
        assertEquals(BigDecimal.ZERO, owlOrder.getMarketplaceTax());
        assertEquals("PayPal", owlOrder.getPaymentMethod());
        assertEquals("PAYPAL-3060526", owlOrder.getPaymentTransactionId());
        assertEquals("EUR", owlOrder.getPaymentCurrency());
        assertEquals(new BigDecimal("8.81"), owlOrder.getGrandTotal());
        assertEquals(BigDecimal.ZERO, owlTaxSchemeOrder.getVat());
        assertFalse(owlTaxSchemeOrder.isVatPresent());
        assertEquals(new BigDecimal("1.66"), owlTaxSchemeOrder.getMarketplaceTax());
        assertEquals(new BigDecimal("10.47"), owlTaxSchemeOrder.getCalculatedGrandTotal());
        assertFalse(owlTaxSchemeOrder.isGrandTotalMismatch());
        assertEquals("BrickLink", linkOrder.getSource());
        assertEquals("Link Buyer Real Name", linkOrder.getBuyerName());
        assertEquals(new BigDecimal("3.95"), linkOrder.getOrderTotal());
        assertEquals(new BigDecimal("8.22"), linkOrder.getShipping());
        assertEquals(new BigDecimal("10.19"), linkOrder.getGrandTotal());
        assertEquals(new BigDecimal("12.67"), linkOrder.getCalculatedGrandTotal());
        assertTrue(linkOrder.isGrandTotalMismatch());
        assertEquals(new BigDecimal("1.77"), linkOrder.getVat());
        assertEquals(new BigDecimal("0.50"), linkOrder.getMarketplaceTax());
        assertEquals("Sweden", linkOrder.getLocation());
        assertEquals("PayPal", linkOrder.getPaymentMethod());
        assertEquals("EUR", linkOrder.getPaymentCurrency());
        assertEquals(List.of(2), batchSizes);
    }

    @Test
    void splitsBrickOwlDetailsIntoBatchesOfFifty() {
        var listedOrders = new ArrayList<OrderListItem>();
        for (var index = 1; index <= 51; index++) {
            listedOrders.add(owlListItem(Integer.toString(index), LocalDateTime.of(2026, 8, 1, 12, 0)));
        }
        var batchSizes = new ArrayList<Integer>();
        var service = new AccountingService(
                new StubLinkInternalClient(List.of()),
                () -> listedOrders,
                requests -> {
                    batchSizes.add(requests.size());
                    return responses(requests);
                }
        );

        var orders = service.findOrders(YearMonth.of(2026, 8));

        assertEquals(51, orders.size());
        assertEquals(List.of(50, 1), batchSizes);
    }

    private LinkOrderSummary brickLinkOrder() {
        var order = new LinkOrderSummary();
        order.setOrderId(32266548L);
        order.setOrderDate(LocalDate.of(2026, 8, 5));
        order.setBuyer("Link Buyer Real Name");
        order.setTotalLots(3);
        order.setTotalItems(3);
        order.setTotal(new BigDecimal("1.53"));
        order.setAdditionalCharge1(new BigDecimal("2.42"));
        order.setShipping(new BigDecimal("6.24"));
        order.setAdditionalCharge2(new BigDecimal("1.98"));
        order.setSalesTax(new BigDecimal("0.20"));
        order.setVat(new BigDecimal("0.30"));
        order.setBaseGrandTotal(new BigDecimal("10.19"));
        order.setVatCharges(new BigDecimal("1.77"));
        order.setLocation("Sweden, Malmö");
        order.setPaymentType("PayPal (Onsite)");
        order.setPaymentCurrencyCode("EUR");
        return order;
    }

    private OrderListItem owlListItem(String orderId, LocalDateTime orderDate) {
        var order = new OrderListItem();
        order.setOrderId(orderId);
        order.setOrderDate(orderDate);
        return order;
    }

    private List<BatchResponse> responses(List<BatchRequest> requests) {
        var responses = new ArrayList<BatchResponse>();
        for (var index = 0; index < requests.size(); index++) {
            var orderId = requests.get(index).getParams().getFirst().get("order_id");
            var body = MAPPER.createObjectNode();
            body.put("order_id", orderId);
            body.put("iso_order_time", "2026-08-06T03:00:53+01:00");
            body.put("buyer_name", "Owl Buyer");
            body.put("total_lots", "4");
            body.put("total_quantity", "5");
            body.put("sub_total", "4.28");
            body.put("ship_total", "4.53");
            body.put("base_order_total", orderId.equals("tax-scheme") ? "10.47" : "8.81");
            body.put("payment_method_type", "paypal");
            body.put("payment_currency", "EUR");
            body.put("payment_total", orderId.equals("tax-scheme") ? "10.47" : "8.81");
            body.put("payment_transaction_id", "PAYPAL-" + orderId);
            body.put("tax_amount", "1.66");
            if (orderId.equals("tax-scheme")) {
                body.put("tax_scheme_id", "ioss");
            } else {
                body.putNull("tax_scheme_id");
            }
            body.put("ship_country", "Germany");
            body.put("ship_city", "Berlin");
            var response = new BatchResponse();
            response.setRequestNumber(index + 1);
            response.setCode(200);
            response.setBody(body);
            responses.add(response);
        }
        return responses;
    }

    private AccountingOrder order(List<AccountingOrder> orders, String orderNumber) {
        return orders.stream()
                .filter(order -> orderNumber.equals(order.getOrderNumber()))
                .findFirst()
                .orElseThrow();
    }

    private static class StubLinkInternalClient extends LinkInternalClient {
        private final List<LinkOrderSummary> orders;

        private StubLinkInternalClient(List<LinkOrderSummary> orders) {
            super(null, null);
            this.orders = orders;
        }

        @Override
        public List<LinkOrderSummary> listOrders(OrderExportRequest request) {
            return orders;
        }
    }
}
