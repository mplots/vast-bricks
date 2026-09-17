package com.vastbricks.api.shippingprice;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * What Latvijas Pasts charges to post one weight band to one destination one way.
 *
 * <p>No {@code @TenantId}, alone among the feature entities. A published tariff is the same price for every store,
 * is fetched with no credential, and is owned by no tenant; stamping it per tenant would buy a duplicate of these
 * rows per store to protect what anybody can read on a web page. See {@code vast-docs/shipping-prices.md}.
 *
 * <p>A row is closed rather than overwritten. A sweep that finds the price unchanged moves {@link #checkedAt} and
 * nothing else; one that finds it changed sets {@link #validTo} here and writes a new row, so the table still
 * answers what a band cost on the day an order shipped.
 */
@Entity
@Table(name = "shipping_prices", schema = "vast")
@Getter
@Setter
@NoArgsConstructor
class ShippingPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** The provider's own destination code, which is usually but not always ISO-3166 alpha-2. */
    @Column(name = "country_code", nullable = false, length = 10, updatable = false)
    private String countryCode;

    @Column(name = "country_name", nullable = false, updatable = false)
    private String countryName;

    @Enumerated(EnumType.STRING)
    @Column(name = "shipment_type", nullable = false, length = 20, updatable = false)
    private ShipmentType shipmentType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, updatable = false)
    private ShippingService service;

    @Column(name = "weight_from_g", nullable = false, updatable = false)
    private int weightFromGrams;

    @Column(name = "weight_to_g", nullable = false, updatable = false)
    private int weightToGrams;

    /** The weight cost alone. For {@link ShippingService#ECONOMY} it is the whole price. */
    @Column(name = "base_price", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal basePrice;

    /** What tracking adds, stated apart by the provider and kept apart so a change says which half moved. */
    @Column(name = "tracking_fee", nullable = false, precision = 19, scale = 2, updatable = false)
    private BigDecimal trackingFee = BigDecimal.ZERO;

    @Column(nullable = false, length = 3, updatable = false)
    private String currency = "EUR";

    /** The fewest days the provider says this takes, or null where it states no estimate. */
    @Column(name = "delivery_days_min", updatable = false)
    private Integer deliveryDaysMin;

    /** The most days it says the same service takes; equal to the minimum where it states one number. */
    @Column(name = "delivery_days_max", updatable = false)
    private Integer deliveryDaysMax;

    @Column(name = "valid_from", nullable = false, updatable = false)
    private Instant validFrom = Instant.now();

    /** Set when a later sweep found a different price. Null while this is the current one. */
    @Column(name = "valid_to")
    private Instant validTo;

    @Column(name = "checked_at", nullable = false)
    private Instant checkedAt = Instant.now();

    /** What the shipment actually costs: the base and the tracking it carries. */
    BigDecimal totalPrice() {
        return basePrice.add(trackingFee == null ? BigDecimal.ZERO : trackingFee);
    }

    /**
     * Whether this row states the same offer as the one a sweep just read: the same money and the same wait.
     *
     * <p>How long a shipment takes is part of what was offered, not metadata about the sweep, so a changed estimate
     * closes this row and opens another exactly as a changed price does. Updating it in place instead would leave
     * every historical row carrying today's estimate, which is a quiet untruth about what the store was offered.
     */
    boolean statesSameOffer(ShippingPriceBand band) {
        return basePrice.compareTo(band.getBasePrice()) == 0
                && totalPrice().compareTo(band.getBasePrice().add(band.getTrackingFee())) == 0
                && Objects.equals(deliveryDaysMin, band.getDeliveryDaysMin())
                && Objects.equals(deliveryDaysMax, band.getDeliveryDaysMax());
    }
}
