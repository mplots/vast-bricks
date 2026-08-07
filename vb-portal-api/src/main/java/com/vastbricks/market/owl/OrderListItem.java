package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderListItem {
    @JsonProperty("order_id")
    private String orderId;

    @JsonProperty("order_date")
    @JsonDeserialize(using = OwlLocalDateTimeDeserializer.class)
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
