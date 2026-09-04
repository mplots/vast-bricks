package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Data;

/** One page of the PayPal transaction search. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
class PayPalTransactionsResponse {

    @JsonProperty("transaction_details") private List<PayPalTransaction> transactionDetails;
    private Integer page;
    @JsonProperty("total_pages") private Integer totalPages;
    @JsonProperty("total_items") private Integer totalItems;
}
