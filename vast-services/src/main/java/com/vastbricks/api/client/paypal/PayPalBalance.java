package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/** What PayPal holds in one currency, as its balances report states it. */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalBalance {

    private String currency;

    /** Whether this is the balance the account is held in, the rest being currencies it also happens to hold. */
    private Boolean primary;

    /** Everything the account holds in the currency, what is withheld against disputes included. */
    @JsonProperty("total_balance") private PayPalAmount totalBalance;

    /** What of it can be spent or withdrawn now. */
    @JsonProperty("available_balance") private PayPalAmount availableBalance;

    /** What PayPal is holding back, against a dispute or a rolling reserve. */
    @JsonProperty("withheld_balance") private PayPalAmount withheldBalance;
}
