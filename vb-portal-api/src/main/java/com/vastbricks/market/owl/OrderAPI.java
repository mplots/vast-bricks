package com.vastbricks.market.owl;

import org.springframework.core.ParameterizedTypeReference;

import java.util.List;
import java.util.Map;

public class OrderAPI {
    private final String baseUrl;
    private final String key;
    private final RestClient restClient;

    OrderAPI(String baseUrl, String key) {
        this(baseUrl, key, new RestClient());
    }

    OrderAPI(String baseUrl, String key, RestClient restClient) {
        this.baseUrl = baseUrl;
        this.key = key;
        this.restClient = restClient;
    }

    public List<OrderListItem> list() {
        return restClient.get(
                baseUrl + "/v1/order/list?key={key}",
                new ParameterizedTypeReference<List<OrderListItem>>() {},
                Map.of("key", key)
        ).getBody();
    }

    public OrderView view(String orderId) {
        return restClient.get(
                baseUrl + "/v1/order/view?key={key}&order_id={orderId}",
                OrderView.class,
                Map.of("key", key, "orderId", orderId)
        ).getBody();
    }
}
