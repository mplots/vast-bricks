package com.vastbricks.api.shippingprice;

/** A tariff the sweep could not read, which is a run that fails rather than a table written to half-heartedly. */
class ShippingPriceException extends RuntimeException {

    ShippingPriceException(String message) {
        super(message);
    }
}
