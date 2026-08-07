package com.vastbricks.market.owl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderListItemTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void mapsOrderListResponse() throws Exception {
        var orders = MAPPER.readValue("""
                [
                  {
                    "order_id": "3060526",
                    "order_date": "1785981653",
                    "total_quantity": "5",
                    "total_lots": "4",
                    "base_order_total": "8.81",
                    "status": "Shipped",
                    "status_id": "5"
                  },
                  {
                    "order_id": "4696896",
                    "order_date": "1785903724",
                    "total_quantity": "1",
                    "total_lots": "1",
                    "base_order_total": "9.52",
                    "status": "Shipped",
                    "status_id": "5"
                  }
                ]
                """, new TypeReference<List<OrderListItem>>() {});

        assertEquals(2, orders.size());
        assertEquals("3060526", orders.getFirst().getOrderId());
        assertEquals(
                Instant.ofEpochSecond(1785981653L).atZone(ZoneId.systemDefault()).toLocalDateTime(),
                orders.getFirst().getOrderDate()
        );
        assertEquals(5, orders.getFirst().getTotalQuantity());
        assertEquals(4, orders.getFirst().getTotalLots());
        assertEquals(new BigDecimal("8.81"), orders.getFirst().getBaseOrderTotal());
        assertEquals("Shipped", orders.getFirst().getStatus());
        assertEquals("5", orders.getFirst().getStatusId());
    }
}
