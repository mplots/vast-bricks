package com.vastbricks.market.owl;

import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Data
@SuperBuilder
@EqualsAndHashCode
public class ShippingMethod {
    private Long id;
    private String name;
    private LocalDateTime updated;

    private Long carrierId;
    private String carrierName;
    private Boolean enabled;
    private String deleteToken;
}
