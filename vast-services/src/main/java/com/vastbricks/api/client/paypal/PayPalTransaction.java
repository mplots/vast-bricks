package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/** One transaction of the PayPal transaction search, in the shape PayPal reports it. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalTransaction {

    @JsonProperty("transaction_info") private PayPalTransactionInfo transactionInfo;
    @JsonProperty("payer_info") private PayPalPayerInfo payerInfo;
    @JsonProperty("shipping_info") private PayPalShippingInfo shippingInfo;
}
