package com.vastbricks.api.shippingprice;

import lombok.Getter;

/** What a sweep came to. */
@Getter
class ShippingPriceSyncTally {

    /** Bands there was no price for before. */
    int added;

    /** Bands whose price moved, each of which closed a row and opened another. */
    int changed;

    /** Bands the provider still states the same price for. */
    int unchanged;

    /** Destinations the provider would not price, or described in a shape a tariff does not come in. */
    int skipped;

    /** Bands the provider no longer prices at all, whose rows were closed and not replaced. */
    int closed;
}
