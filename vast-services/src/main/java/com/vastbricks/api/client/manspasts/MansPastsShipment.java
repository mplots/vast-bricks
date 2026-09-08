package com.vastbricks.api.client.manspasts;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One row of the Mans Pasts shipment export, as the spreadsheet stated it.
 *
 * <p>The export is the register a store sees when it signs in: one row per shipment it has handed to Latvijas Pasts,
 * carrying the recipient it was addressed to, the customs content it was declared with and what the post office
 * charged for it. The field names are this side's own — the export heads its columns in Latvian — and each column of
 * the spreadsheet is one field here, so nothing the provider stated is dropped on the way in.
 *
 * <p>Values are typed no further than the cell allowed: an amount is an amount, a date a date, and everything the
 * export writes as a sentence stays the text it was.
 */
@Data
@NoArgsConstructor
public class MansPastsShipment {

    /** The tracking number Latvijas Pasts gave the shipment, which is what the register is read by. */
    private String barcode;

    /** What kind of shipment it is, as the export words it: {@code Letter (items)}. */
    private String shipmentType;

    /** The service it was sent under: {@code tracked}, {@code ordinary}. */
    private String serviceType;

    /** Where the shipment has got to: {@code processed}, {@code sent}. */
    private String status;

    /** The dispatch list the shipment was handed over on, which several shipments of one day share. */
    private String listNumber;

    private String recipientName;

    private String company;

    /** The destination country, as its two-letter code. */
    private String country;

    /** The whole address as one line, the way the export states it. */
    private String address;

    private String postalCode;

    /** Whatever the store noted on the shipment, which is normally the marketplace order it is for. */
    private String notes;

    private String groups;

    private String email;

    private String phone;

    /** The customs content declaration: what is in the parcel, how many, how heavy and what it is worth. */
    private String contentName;

    private Integer quantity;

    private BigDecimal weightKg;

    private BigDecimal value;

    private String hsCode;

    private String originCountry;

    private String additionalServices;

    private BigDecimal additionalServicesPrice;

    private BigDecimal insuredAmount;

    private BigDecimal insuranceFee;

    /** When the shipment was handed over to Latvijas Pasts. */
    private LocalDateTime submittedAt;

    /** When Latvijas Pasts processed it, which is when it started moving. */
    private LocalDateTime processedAt;

    /** What Latvijas Pasts weighed it at, which is what it is charged on. */
    private BigDecimal weighedWeightKg;

    private BigDecimal postageFee;

    /** What the shipment came to: the postage with every additional service on it. */
    private BigDecimal totalAmount;

    /** The store the shipment was sent from, as the export writes it: the name and the return address in one line. */
    private String sender;

    /** When the shipment was created in Mans Pasts, which is before it was handed over. */
    private LocalDateTime createdAt;

    /** What the export says about the notification e-mail, as the sentence it writes it in. */
    private String emailNotice;
}
