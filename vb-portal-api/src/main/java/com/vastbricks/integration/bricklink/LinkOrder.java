package com.vastbricks.integration.bricklink;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class LinkOrder {
    @JsonProperty("order_id")
    private Long orderId;
    @JsonProperty("date_ordered")
    private String dateOrdered;
    @JsonProperty("date_status_changed")
    private String dateStatusChanged;
    @JsonProperty("seller_name")
    private String sellerName;
    @JsonProperty("store_name")
    private String storeName;
    @JsonProperty("buyer_name")
    private String buyerName;
    @JsonProperty("buyer_email")
    private String buyerEmail;
    @JsonProperty("buyer_order_count")
    private Integer buyerOrderCount;
    @JsonProperty("require_insurance")
    private Boolean requireInsurance;
    private String status;
    @JsonProperty("is_invoiced")
    private Boolean invoiced;
    @JsonProperty("is_filed")
    private Boolean filed;
    @JsonProperty("drive_thru_sent")
    private Boolean driveThruSent;
    @JsonProperty("salesTax_collected_by_bl")
    private Boolean salesTaxCollectedByBrickLink;
    @JsonProperty("vat_collected_by_bl")
    private Boolean vatCollectedByBrickLink;
    private String remarks;
    @JsonProperty("total_count")
    private Integer totalCount;
    @JsonProperty("unique_count")
    private Integer uniqueCount;
    @JsonProperty("total_weight")
    private BigDecimal totalWeight;
    private Payment payment;
    private Shipping shipping;
    private Cost cost;
    @JsonProperty("disp_cost")
    private Cost displayCost;

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Payment {
        private String method;
        @JsonProperty("currency_code")
        private String currencyCode;
        @JsonProperty("date_paid")
        private String datePaid;
        private String status;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Shipping {
        @JsonProperty("method_id")
        private Long methodId;
        private String method;
        private Address address;
        @JsonProperty("date_shipped")
        private String dateShipped;
        @JsonProperty("tracking_no")
        private String trackingNumber;
        @JsonProperty("tracking_link")
        private String trackingLink;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Address {
        private Name name;
        private String full;
        private String address1;
        private String address2;
        @JsonProperty("country_code")
        private String countryCode;
        private String city;
        private String state;
        @JsonProperty("postal_code")
        private String postalCode;
        @JsonProperty("phone_number")
        private String phoneNumber;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Name {
        private String full;
        private String first;
        private String last;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Cost {
        @JsonProperty("currency_code")
        private String currencyCode;
        private BigDecimal subtotal;
        @JsonProperty("grand_total")
        private BigDecimal grandTotal;
        private BigDecimal etc1;
        private BigDecimal etc2;
        private BigDecimal insurance;
        private BigDecimal shipping;
        private BigDecimal credit;
        private BigDecimal coupon;
        @JsonProperty("salesTax")
        private BigDecimal salesTax;
        private BigDecimal vat;
        @JsonProperty("final_total")
        private BigDecimal finalTotal;
        @JsonProperty("vat_rate")
        private BigDecimal vatRate;
        @JsonProperty("vat_amount")
        private BigDecimal vatAmount;
    }
}
