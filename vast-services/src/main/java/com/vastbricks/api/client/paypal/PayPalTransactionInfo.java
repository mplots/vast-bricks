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

    @JsonProperty("transaction_status") private String transactionStatus;

    /** What the marketplace asked the payment to be labelled with. BrickOwl puts its order number here. */
    @JsonProperty("invoice_id") private String invoiceId;

    @JsonProperty("custom_field") private String customField;
    @JsonProperty("transaction_subject") private String transactionSubject;
}
