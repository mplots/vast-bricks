package com.vastbricks.market.owl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class BatchResponseTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void mapsGenericResponseAndConvertsBodyToRequestedType() throws Exception {
        var responses = MAPPER.readValue("""
                [{
                  "req_num": 1,
                  "code": 200,
                  "body": {
                    "order_id": "3060526",
                    "order_time": "1785981653",
                    "iso_order_time": "2026-08-06T03:00:53+01:00",
                    "ship_total": "4.53"
                  }
                }]
                """, new TypeReference<List<BatchResponse>>() {});

        var response = responses.getFirst();
        var order = response.bodyAs(OrderView.class);

        assertEquals(1, response.getRequestNumber());
        assertEquals(200, response.getCode());
        assertEquals("3060526", order.getOrderId());
        assertEquals(LocalDateTime.of(2026, 8, 6, 3, 0, 53), order.getIsoOrderTime());
        assertEquals(new BigDecimal("4.53"), order.getShipping());
    }
}
