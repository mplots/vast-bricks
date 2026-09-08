package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

/** What PayPal held at one moment, one entry per currency. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalBalancesResponse {

    private List<PayPalBalance> balances;

    /** The moment PayPal answered for, which is not necessarily the one that was asked about. */
    @JsonProperty("as_of_time") private String asOfTime;
}
