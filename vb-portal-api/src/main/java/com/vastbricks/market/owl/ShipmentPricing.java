package com.vastbricks.market.owl;

import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;

@Builder
@Data
@EqualsAndHashCode
public class ShipmentPricing {
    private BigDecimal weightTo;
    private BigDecimal price;
}
