package com.vastbricks.shipping;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class Order {
    private String cookie;
    private Tariff.Type type;
    private Tariff.Mode mode;
}
