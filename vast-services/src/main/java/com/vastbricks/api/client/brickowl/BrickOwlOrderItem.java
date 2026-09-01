package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickOwlOrderItem {

    @JsonProperty("base_price")
    private BigDecimal basePrice;

    @JsonProperty("ordered_quantity")
    private BigDecimal orderedQuantity;
}
