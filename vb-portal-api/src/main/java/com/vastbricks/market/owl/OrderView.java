package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderView {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("ship_method_name")
    private String shipMethodName;

    private BigDecimal weight;

    @JsonProperty("total_quantity")
    private Integer totalQuantity;

    @JsonProperty("sub_total")
    private BigDecimal subTotal;

    @JsonProperty("customer_email")
    private String customerEmail;

    @JsonProperty("buyer_name")
    private String buyerName;

    @JsonProperty("ship_first_name")
    private String shipFirstName;

    @JsonProperty("ship_last_name")
    private String shipLastName;

    @JsonProperty("ship_country_code")
    private String shipCountryCode;

    @JsonProperty("ship_post_code")
    private String shipPostCode;

    @JsonProperty("ship_street_1")
    private String shipStreet1;

    @JsonProperty("ship_street_2")
    private String shipStreet2;

    @JsonProperty("ship_city")
    private String shipCity;

    @JsonProperty("ship_region")
    private String shipRegion;

    @JsonProperty("ship_phone")
    private String shipPhone;
}
