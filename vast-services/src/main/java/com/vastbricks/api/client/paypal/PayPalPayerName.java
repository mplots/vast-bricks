package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/** How PayPal spells the payer's name. Which parts are present varies by payer. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalPayerName {

    @JsonProperty("given_name") private String givenName;
    private String surname;
    @JsonProperty("full_name") private String fullName;
    @JsonProperty("alternate_full_name") private String alternateFullName;
}
