package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/**
 * One weight band's price - without saying which weight band.
 *
 * <p>That omission is the provider's, not this model's. A ladder of bands comes back as a bare list of prices with
 * no weight against any of them, so which band a price belongs to has to be worked out from where it falls when the
 * ladder is sorted. {@code com.vastbricks.api.shippingprice} is where that is done, and where it is checked.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsWeightCost {

    /** The price in whole cents, VAT included. */
    private Integer priceWithTax;

    /** Whether this is the insured variant of the price, the two ladders arriving interleaved in one list. */
    private boolean insurance;
}
