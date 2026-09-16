package com.vastbricks.api.client.bricklink;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * What this client reads out of a BrickLink order.
 *
 * <p>Only the fields a caller decides something by. What is archived is the response as BrickLink sent it, so the
 * whole order is kept in the raw JSON beside this rather than in a model that would have to grow every time
 * BrickLink adds a field.
 */
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickLinkOrder {

    @JsonProperty("order_id")
    private Long orderId;

    /** When the order was placed. */
    @JsonProperty("date_ordered")
    private String dateOrdered;

    /** When the order last changed, which is what an archived copy is named after. */
    @JsonProperty("date_status_changed")
    private String dateStatusChanged;

    private String status;

    /**
     * The buyer's account with BrickLink, not their name, which is on the address an order is shipped to. This is
     * the one place BrickLink states the account without being asked which of the two it should state: the
     * accounting export names a buyer by account or by person under one element, according to the request.
     */
    @JsonProperty("buyer_name")
    private String buyerName;

    /** Where the order is going, which is the only place BrickLink states the buyer by name. */
    private Shipping shipping;

    /** How many items the order is for, counting every one of them. */
    @JsonProperty("total_count")
    private Integer totalCount;

    /** How many lots the order is for: the distinct items, whatever quantity each was ordered in. */
    @JsonProperty("unique_count")
    private Integer uniqueCount;

    /** How the order was paid, and in what. */
    private Payment payment;

    /** What the order came to in the store's own currency. {@code disp_cost} is the same in the buyer's. */
    private Cost cost;

    /** How an order was paid, as BrickLink states it. */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Payment {

        private String method;

        /** What the buyer paid in, which need not be the currency the order is totalled in. */
        @JsonProperty("currency_code")
        private String currencyCode;
    }

    /** Where an order is going. Only the name on the address, which is the buyer's own. */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Shipping {

        private Address address;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Address {

        private Name name;

        /** Where the parcel went, as a two-letter code. */
        @JsonProperty("country_code")
        private String countryCode;
    }

    /** The recipient, whom BrickLink states in parts and whole. */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Name {

        private String full;
    }

    /** What an order came to, as BrickLink breaks it down. Only the total this client's callers decide by. */
    @Getter
    @Setter
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Cost {

        @JsonProperty("currency_code")
        private String currencyCode;

        @JsonProperty("grand_total")
        private String grandTotal;

        private String subtotal;

        private String shipping;
    }
}
