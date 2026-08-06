package com.vastbricks.integration.bricklink;

public enum OrderType {
    RECEIVED("received"),
    PLACED("placed");

    private final String apiValue;

    OrderType(String apiValue) {
        this.apiValue = apiValue;
    }

    String apiValue() {
        return apiValue;
    }
}
