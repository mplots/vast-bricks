package com.vastbricks.shippinglabel;

import lombok.Data;

import java.math.BigDecimal;

@Data
class BrickOwlShippingRequest {
    private String orderId;
    private BigDecimal weight;
}
