package com.vastbricks.market.link;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class Order {
    private Meta meta;
    private Response data;

    @Data
    public static final class Meta {
        private String description;
        private String message;
        private String code;
    }

    @Data
    public static final class Response {
        @JsonProperty("order_id")
        private Long orderId;
        @JsonProperty("date_ordered")
        private LocalDateTime dateOrdered;
        @JsonProperty("date_status_changed")
        private LocalDateTime dateStatusChanged;
        @JsonProperty("seller_name")
        private String sellerName;
        @JsonProperty("store_name")
        private String storeName;
        @JsonProperty("buyer_name")
        private String buyerName;
        @JsonProperty("buyer_email")
        private String buyerEmail;
        @JsonProperty("require_insurance")
        private Boolean requireInsurance;
        @JsonProperty("status")
        private String status;
        @JsonProperty("is_invoiced")
        private Boolean invoiced;
        @JsonProperty("total_count")
        private Integer totalCount;
        @JsonProperty("unique_count")
        private Integer uniqueCount;
        @JsonProperty("total_weight")
        private BigDecimal totalWeight;
        @JsonProperty("buyer_order_count")
        private Short buyerOrderCount;
        @JsonProperty("is_filed")
        private Boolean filed;
        @JsonProperty("drive_thru_sent")
        private Boolean driveThruSent;
        @JsonProperty("salesTax_collected_by_bl")
        private Boolean salesTaxCollectedByBl;
        @JsonProperty("vat_collected_by_bl")
        private Boolean vatCollectedByBl;
        private Shipping shipping;
        private Cost cost;
        @JsonProperty("disp_cost")
        private Cost dispCost;
    }

    @Data
    public static final class Payment {
        private String method;
        @JsonProperty("currency_code")
        private String currencyCode;
        @JsonProperty("date_paid")
        private LocalDateTime datePaid;
        private String status;
    }

    @Data
    public static final class Shipping {
        @JsonProperty("method_id")
        private Long methodId;
        private String method;
        private Address address;
        private LocalDateTime dateShipped;
    }

    @Data
    public static final class Address {
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
    public static final class Name {
        private String full;
        private String first;
        private String last;
    }

    @Data
    public static final class Cost {
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
