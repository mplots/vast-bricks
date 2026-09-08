package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class PayPalTransactionInfo {

    @JsonProperty("transaction_id") private String transactionId;

    /**
     * The transaction this one was raised against, such as the payment a partner fee was taken from. PayPal names a
     * payment's own base id here too, which is the checkout it came from rather than another transaction.
     */
    @JsonProperty("paypal_reference_id") private String payPalReferenceId;

    /** What happened, such as {@code T0006} for a payment received. */
    @JsonProperty("transaction_event_code") private String transactionEventCode;

    @JsonProperty("transaction_initiation_date") private OffsetDateTime transactionInitiationDate;
    @JsonProperty("transaction_amount") private PayPalAmount transactionAmount;
    @JsonProperty("fee_amount") private PayPalAmount feeAmount;

    /**
     * What the gross amount was made up of, as PayPal breaks it down. These are the lines PayPal's own transaction
     * details panel lists above the gross, and what is left of the gross once they are taken off is the purchase
     * itself. A field PayPal did not state is one the transaction had none of.
     */
    @JsonProperty("sales_tax_amount") private PayPalAmount salesTaxAmount;
    @JsonProperty("shipping_amount") private PayPalAmount shippingAmount;
    @JsonProperty("handling_amount") private PayPalAmount handlingAmount;
    @JsonProperty("insurance_amount") private PayPalAmount insuranceAmount;
    @JsonProperty("discount_amount") private PayPalAmount discountAmount;
    @JsonProperty("shipping_discount_amount") private PayPalAmount shippingDiscountAmount;

    @JsonProperty("transaction_status") private String transactionStatus;

    /** What the marketplace asked the payment to be labelled with. BrickOwl puts its order number here. */
    @JsonProperty("invoice_id") private String invoiceId;

    @JsonProperty("custom_field") private String customField;
    @JsonProperty("transaction_subject") private String transactionSubject;
}
