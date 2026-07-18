package com.vastbricks.shippinglabel;

import lombok.Data;

import java.math.BigDecimal;

@Data
class BricklinkShippingRequest {
    private Long orderId;
    private BigDecimal weight;
}
