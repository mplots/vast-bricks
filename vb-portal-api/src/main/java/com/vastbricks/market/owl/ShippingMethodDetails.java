package com.vastbricks.market.owl;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.List;

@Data
@SuperBuilder
@EqualsAndHashCode
public class ShippingMethodDetails extends ShippingMethod {
    private Boolean share;
    private Boolean expedited;
    private Boolean requirePhone;
    private Boolean dontDefault;

    private BigDecimal minPriceLimit;
    private BigDecimal maxPriceLimit;
    private BigDecimal volume;
    private BigDecimal totalDimensions;
    private String note;

    private ShipmentDimensions restrictions;

    private List<Country> countries;

    private BigDecimal initialWeightFrom;
    private List<ShipmentPricing> pricing;
}
