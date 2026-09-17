package com.vastbricks.api.shippingprice;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

/** Every response body of the shipping prices feature. */
final class ShippingPricePayload {

    private ShippingPricePayload() {
    }

    /** One destination there are prices for. */
    @Getter
    @AllArgsConstructor
    static final class CountryResponse {

        /** The provider's own code, which the price listing is asked for by. */
        private final String code;

        private final String name;
    }

    /** One destination's current tariff, as the screen lays it out. */
    @Getter
    @AllArgsConstructor
    static final class CountryPricesResponse {

        private final String code;

        private final String name;

        /** When the provider last confirmed these prices, which is what says how stale the screen is. */
        private final Instant checkedAt;

        private final List<PriceResponse> prices;
    }

    /** One weight band at one service. */
    @Getter
    @AllArgsConstructor
    static final class PriceResponse {

        private final ShipmentType shipmentType;

        private final ShippingService service;

        private final int weightFromGrams;

        private final int weightToGrams;

        /** The weight cost alone. */
        private final BigDecimal basePrice;

        /** What tracking adds, kept apart from the base because the provider states it apart. */
        private final BigDecimal trackingFee;

        /** What the shipment costs: the two above, added. The screen shows this and the split on request. */
        private final BigDecimal totalPrice;

        private final String currency;

        /** The fewest days the provider says this takes, or null where it states no estimate. */
        private final Integer deliveryDaysMin;

        /** The most days it says the same service takes; equal to the minimum where it states one number. */
        private final Integer deliveryDaysMax;

        /** When this price came into force, which is not when it was last confirmed. */
        private final Instant validFrom;
    }
}
