package com.vastbricks.api.shippingprice;

import java.math.BigDecimal;
import lombok.Builder;
import lombok.Getter;

/** One weight band's offer, as the sweep reads it before deciding what to do with it. */
@Getter
@Builder
class ShippingPriceBand {

    private final ShipmentType shipmentType;
    private final ShippingService service;
    private final int weightFromGrams;
    private final int weightToGrams;
    private final BigDecimal basePrice;
    private final BigDecimal trackingFee;

    /** The fewest days the provider says this takes, or null where it states no estimate. */
    private final Integer deliveryDaysMin;

    /** The most days it says the same service takes; equal to the minimum where it states one number. */
    private final Integer deliveryDaysMax;

    /** Whether this band is the one a shipment of the stated weight falls into. */
    boolean covers(int weightGrams) {
        return weightGrams >= weightFromGrams && weightGrams <= weightToGrams;
    }

    BigDecimal totalPrice() {
        return basePrice.add(trackingFee);
    }
}
