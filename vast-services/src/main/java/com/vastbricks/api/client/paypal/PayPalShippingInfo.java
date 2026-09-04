package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalShippingInfo {

    /** Who the order ships to, which is a second spelling of the buyer's name. */
    private String name;
}
