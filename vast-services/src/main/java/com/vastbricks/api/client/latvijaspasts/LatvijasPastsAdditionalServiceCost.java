package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

/** Something buyable on top of the postage: tracking, insurance, a courier pick-up. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsAdditionalServiceCost {

    /** {@code trackingInternational}, {@code trackingLatvia}, {@code insurance}, {@code courierPickUp} and others. */
    private String name;

    /** The charge in whole cents, VAT included, or zero for a service charged as a ratio of the declared value. */
    private Integer priceWithTax;
}
