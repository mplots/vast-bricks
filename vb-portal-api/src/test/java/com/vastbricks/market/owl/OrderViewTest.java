package com.vastbricks.market.owl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class OrderViewTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void mapsEveryOrderViewResponseField() throws Exception {
        var response = MAPPER.readTree("""
                {
                  "order_id": "3060526",
                  "order_time": "1785981653",
                  "updated_time": "1786035363",
                  "processed_time": "1786035363",
                  "iso_order_time": "2026-08-06T03:00:53+01:00",
                  "iso_processed_time": "2026-08-06T17:56:03+01:00",
                  "store_id": "26925",
                  "ship_method_name": "International Post",
                  "ship_method_id": "152381",
                  "status": "Shipped",
                  "status_id": "5",
                  "weight": "2.402",
                  "ship_total": "4.53",
                  "eu_duty": "0.00",
                  "buyer_note": "",
                  "total_quantity": "5",
                  "total_lots": "4",
                  "base_currency": "EUR",
                  "payment_method_type": "stripe",
                  "payment_currency": "EUR",
                  "payment_total": "8.81",
                  "base_order_total": "8.81",
                  "sub_total": "4.28",
                  "coupon_discount": "0.00",
                  "payment_method_note": "",
                  "payment_transaction_id": "transaction-id",
                  "tax_rate": "0",
                  "tax_amount": "0",
                  "tax_scheme_id": null,
                  "tracking_number": null,
                  "buyer_name": "Buyer Name",
                  "combine_with": null,
                  "refund_shipping": "0.00",
                  "refund_eu_duty": "0.00",
                  "refund_adjustment": "0.00",
                  "refund_subtotal": "0.00",
                  "refund_total": "0.00",
                  "refund_note": null,
                  "customer_feedback_left": 0,
                  "store_feedback_left": 0,
                  "my_cost_total": "0",
                  "affiliate_fee": "0",
                  "brickowl_fee": "0.113",
                  "seller_note": null,
                  "customer_email": "buyer@example.com",
                  "customer_user_id": "3117637",
                  "customer_username": "buyer",
                  "message_count": "0",
                  "utm_source": null,
                  "utm_medium": null,
                  "ship_first_name": "Buyer",
                  "ship_last_name": "Name",
                  "ship_country_code": "BR",
                  "ship_country": "Brazil",
                  "ship_post_code": "00000-000",
                  "ship_street_1": "Street 1",
                  "ship_street_2": "House",
                  "ship_city": "City",
                  "ship_region": "Region",
                  "ship_phone": "+00 000000000",
                  "ship_tax": "tax-id",
                  "ship_collection_point": null,
                  "billing_first_name": "Buyer",
                  "billing_last_name": "Name",
                  "billing_country_code": "BR",
                  "billing_country": "Brazil",
                  "billing_post_code": "00000-000",
                  "billing_street_1": "Street 1",
                  "billing_street_2": "House",
                  "billing_city": "City",
                  "billing_region": "Region",
                  "billing_phone": "+00 000000000",
                  "billing_tax": "tax-id",
                  "notices": ["Import notice"]
                }
                """);

        var order = MAPPER.treeToValue(response, OrderView.class);

        assertEquals(fieldNames(response), mappedFieldNames());
        assertEquals("3060526", order.getOrderId());
        assertEquals(
                Instant.ofEpochSecond(1785981653L).atZone(ZoneId.systemDefault()).toLocalDateTime(),
                order.getOrderTime()
        );
        assertEquals(LocalDateTime.of(2026, 8, 6, 3, 0, 53), order.getIsoOrderTime());
        assertEquals(new BigDecimal("2.402"), order.getWeight());
        assertEquals(new BigDecimal("4.53"), order.getShipping());
        assertEquals(5, order.getTotalQuantity());
        assertEquals(new BigDecimal("0.113"), order.getBrickOwlFee());
        assertEquals("BR", order.getShipCountryCode());
        assertEquals("Street 1", order.getBillingStreet1());
        assertEquals(Set.of("Import notice"), Set.copyOf(order.getNotices()));
        assertNull(order.getTrackingNumber());
        assertNull(order.getShipCollectionPoint());
    }

    @Test
    void acceptsLegacyShippingField() throws Exception {
        var order = MAPPER.readValue("{\"shipping\": \"7.50\"}", OrderView.class);

        assertEquals(new BigDecimal("7.50"), order.getShipping());
    }

    private Set<String> fieldNames(JsonNode node) {
        var fieldNames = new HashSet<String>();
        node.fieldNames().forEachRemaining(fieldNames::add);
        return fieldNames;
    }

    private Set<String> mappedFieldNames() {
        var type = MAPPER.constructType(OrderView.class);
        var properties = MAPPER.getDeserializationConfig().introspect(type).findProperties();
        var fieldNames = new HashSet<String>();
        properties.forEach(property -> fieldNames.add(property.getName()));
        return fieldNames;
    }
}
