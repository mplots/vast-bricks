package com.vastbricks.shipping;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class Order {
    private String cookie;
    private Tariff.Type type;
    private Tariff.Mode mode;

    private String fullName;
    private String email;
    private String telephone;
    private String country;
    private String state;
    private String address1;
    private String address2;
    private String postcode;
    private BigDecimal weight;
    private Integer quantity;
    private BigDecimal packValue;
}
