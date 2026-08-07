package com.vastbricks.market.owl;

import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class OrderAPITest {
    @Test
    void listsOrders() {
        var order = new OrderListItem();
        order.setOrderId("3060526");
        var restClient = new ListRestClient(List.of(order));
        var api = new OrderAPI("https://api.example.com", "api-key", restClient);

        var result = api.list();

        assertEquals(List.of(order), result);
        assertEquals("https://api.example.com/v1/order/list?key={key}", restClient.url);
        assertEquals(Map.of("key", "api-key"), restClient.uriVariables);
        assertEquals(
                "java.util.List<com.vastbricks.market.owl.OrderListItem>",
                restClient.responseType.getType().getTypeName()
        );
    }

    private static class ListRestClient extends RestClient {
        private final List<OrderListItem> response;
        private String url;
        private ParameterizedTypeReference<?> responseType;
        private Map<String, ?> uriVariables;

        private ListRestClient(List<OrderListItem> response) {
            this.response = response;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> ResponseEntity<T> get(
                String url,
                ParameterizedTypeReference<T> responseType,
                Map<String, ?> uriVariables
        ) {
            this.url = url;
            this.responseType = responseType;
            this.uriVariables = uriVariables;
            return ResponseEntity.ok((T) response);
        }
    }
}
