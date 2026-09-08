package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalPayerInfo {

    @JsonProperty("payer_name") private PayPalPayerName payerName;

    /** The account the payer paid from, which is the second thing a PayPal ledger names a counterparty by. */
    @JsonProperty("email_address") private String emailAddress;
}
