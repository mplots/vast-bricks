package com.vastbricks.api.client.latvijaspasts;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.util.List;
import lombok.Data;

/**
 * One way of sending one thing to one destination, as the calculator describes it.
 *
 * <p>The provider's own unit of pricing, and the reason this model is shaped so unlike a price list: a single
 * request comes back as several of these - a small packet, a parcel, a courier delivery - each carrying every
 * weight band it has, and it is the {@link #label} that says which is which.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class LatvijasPastsWorkFlow {

    /**
     * What this way of sending is called, and the only thing that identifies it.
     *
     * <p>The ones that matter here are {@code parcel-economy-small} and {@code parcel-standard-small}, which are the
     * tariff book's Sikpaka, and {@code parcel-standardPlus-large}, which is its Paka. Note that Sikpaka is a
     * {@code parcel} of size {@code small} and not a {@code letter}: the provider's {@code letter} is the tariff
     * book's Vestule, priced differently and for documents.
     */
    private String label;

    private String countryCode;

    /** {@code small} or {@code large} for a cross-border shipment; a size class such as {@code M} for a domestic one. */
    private String shipmentSizeType;

    /**
     * The heaviest this way of sending will carry, stated only when the asked-for weight exceeded it.
     *
     * <p>Which is exactly how the sweep works: asking about a weight nothing can carry is what makes the provider
     * hand over every band at once instead of the one price it was asked for.
     */
    private Integer maxWeightInKg;

    /**
     * Every band's price, unlabelled and in no order. See {@link LatvijasPastsWeightCost}.
     *
     * <p>Read through {@link LatvijasPastsListDeserializer} because for a handful of destinations the provider sends
     * this as an object keyed by position rather than as an array.
     */
    @JsonDeserialize(using = LatvijasPastsListDeserializer.class)
    private List<LatvijasPastsWeightCost> weightCosts;

    /**
     * How long the provider says this takes, in its own wording.
     *
     * <p>A range or a single number of days, written however it pleased: {@code 15 - 20}, {@code 15-20}, {@code 16},
     * and at least once with a trailing space. Kept as the string it sent; reading it into numbers belongs to the
     * feature that stores it.
     */
    private String deliveryDays;

    /** What can be bought on top, tracking among them. Read the same way, and for the same reason. */
    @JsonDeserialize(using = LatvijasPastsListDeserializer.class)
    private List<LatvijasPastsAdditionalServiceCost> additionalServiceCosts;

    /** The price of tracking this way of sending, in cents, or null where it carries no such charge. */
    public Integer trackingCost() {
        if (additionalServiceCosts == null) {
            return null;
        }
        return additionalServiceCosts.stream()
                .filter(cost -> cost.getName() != null && cost.getName().startsWith("tracking"))
                .map(LatvijasPastsAdditionalServiceCost::getPriceWithTax)
                .filter(price -> price != null)
                .findFirst()
                .orElse(null);
    }
}
