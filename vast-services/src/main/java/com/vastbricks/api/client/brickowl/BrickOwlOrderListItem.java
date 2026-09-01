package com.vastbricks.api.client.brickowl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickOwlOrderListItem {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("order_date")
    @JsonDeserialize(using = BrickOwlLocalDateTimeDeserializer.class)
    private LocalDateTime orderDate;

    @JsonProperty("total_quantity")
    private Integer totalQuantity;

    @JsonProperty("total_lots")
    private Integer totalLots;

    @JsonProperty("base_order_total")
    private BigDecimal baseOrderTotal;

    private String status;

    @JsonProperty("status_id")
    private String statusId;
}
