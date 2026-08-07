package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderView {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("order_time")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
    private LocalDateTime orderTime;

    @JsonProperty("updated_time")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
    private LocalDateTime updatedTime;

    @JsonProperty("processed_time")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
    private LocalDateTime processedTime;

    @JsonProperty("iso_order_time")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
    private LocalDateTime isoOrderTime;

    @JsonProperty("iso_processed_time")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
    private LocalDateTime isoProcessedTime;

    @JsonProperty("store_id")
    private String storeId;

    @JsonProperty("ship_method_name")
    private String shipMethodName;

    @JsonProperty("ship_method_id")
    private String shipMethodId;

    private String status;

    @JsonProperty("status_id")
    private String statusId;

    private BigDecimal weight;

    @JsonProperty("ship_total")
    @JsonAlias("shipping")
    private BigDecimal shipping;

    @JsonProperty("eu_duty")
    private BigDecimal euDuty;

    @JsonProperty("buyer_note")
    private String buyerNote;

    @JsonProperty("total_quantity")
    private Integer totalQuantity;

    @JsonProperty("total_lots")
    private Integer totalLots;

    @JsonProperty("base_currency")
    private String baseCurrency;

    @JsonProperty("payment_method_type")
    private String paymentMethodType;

    @JsonProperty("payment_currency")
    private String paymentCurrency;

    @JsonProperty("payment_total")
    private BigDecimal paymentTotal;

    @JsonProperty("base_order_total")
    private BigDecimal baseOrderTotal;

    @JsonProperty("sub_total")
    private BigDecimal subTotal;

    @JsonProperty("coupon_discount")
    private BigDecimal couponDiscount;

    @JsonProperty("payment_method_note")
    private String paymentMethodNote;

    @JsonProperty("payment_transaction_id")
    private String paymentTransactionId;

    @JsonProperty("tax_rate")
    private BigDecimal taxRate;

    @JsonProperty("tax_amount")
    private BigDecimal taxAmount;

    @JsonProperty("tax_scheme_id")
    private String taxSchemeId;

    @JsonProperty("tracking_number")
    private String trackingNumber;

    @JsonProperty("buyer_name")
    private String buyerName;

    @JsonProperty("combine_with")
    private String combineWith;

    @JsonProperty("refund_shipping")
    private BigDecimal refundShipping;

    @JsonProperty("refund_eu_duty")
    private BigDecimal refundEuDuty;

    @JsonProperty("refund_adjustment")
    private BigDecimal refundAdjustment;

    @JsonProperty("refund_subtotal")
    private BigDecimal refundSubtotal;

    @JsonProperty("refund_total")
    private BigDecimal refundTotal;

    @JsonProperty("refund_note")
    private String refundNote;

    @JsonProperty("customer_feedback_left")
    private Integer customerFeedbackLeft;

    @JsonProperty("store_feedback_left")
    private Integer storeFeedbackLeft;

    @JsonProperty("my_cost_total")
    private BigDecimal myCostTotal;

    @JsonProperty("affiliate_fee")
    private BigDecimal affiliateFee;

    @JsonProperty("brickowl_fee")
    private BigDecimal brickOwlFee;

    @JsonProperty("seller_note")
    private String sellerNote;

    @JsonProperty("customer_email")
    private String customerEmail;

    @JsonProperty("customer_user_id")
    private String customerUserId;

    @JsonProperty("customer_username")
    private String customerUsername;

    @JsonProperty("message_count")
    private Integer messageCount;

    @JsonProperty("utm_source")
    private String utmSource;

    @JsonProperty("utm_medium")
    private String utmMedium;

    @JsonProperty("ship_first_name")
    private String shipFirstName;

    @JsonProperty("ship_last_name")
    private String shipLastName;

    @JsonProperty("ship_country_code")
    private String shipCountryCode;

    @JsonProperty("ship_country")
    private String shipCountry;

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

    @JsonProperty("ship_tax")
    private String shipTax;

    @JsonProperty("ship_collection_point")
    private String shipCollectionPoint;

    @JsonProperty("billing_first_name")
    private String billingFirstName;

    @JsonProperty("billing_last_name")
    private String billingLastName;

    @JsonProperty("billing_country_code")
    private String billingCountryCode;

    @JsonProperty("billing_country")
    private String billingCountry;

    @JsonProperty("billing_post_code")
    private String billingPostCode;

    @JsonProperty("billing_street_1")
    private String billingStreet1;

    @JsonProperty("billing_street_2")
    private String billingStreet2;

    @JsonProperty("billing_city")
    private String billingCity;

    @JsonProperty("billing_region")
    private String billingRegion;

    @JsonProperty("billing_phone")
    private String billingPhone;

    @JsonProperty("billing_tax")
    private String billingTax;

    private List<String> notices;
}
