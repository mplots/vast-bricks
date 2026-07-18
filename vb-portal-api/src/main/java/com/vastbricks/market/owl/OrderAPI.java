package com.vastbricks.market.owl;

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

    public OrderView view(String orderId) {
        return restClient.get(
                baseUrl + "/v1/order/view?key={key}&order_id={orderId}",
                OrderView.class,
                Map.of("key", key, "orderId", orderId)
        ).getBody();
    }
}
