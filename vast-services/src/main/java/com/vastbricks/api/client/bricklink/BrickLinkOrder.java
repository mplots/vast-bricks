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

    /** When the order last changed, which is what an archived copy is named after. */
    @JsonProperty("date_status_changed")
    private String dateStatusChanged;

    private String status;

    /** Whether BrickLink collected the VAT, and therefore whether it issued a VAT invoice for the order. */
    @JsonProperty("vat_collected_by_bl")
    private Boolean vatCollectedByBrickLink;
}
