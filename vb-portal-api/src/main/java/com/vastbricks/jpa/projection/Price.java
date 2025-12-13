package com.vastbricks.jpa.projection;


public interface Price {
    Long getOfferId();
    Long getProductId();
    String getWebStore();
    String getPrice();
    String  getTimestamp();
}
