package com.vastbricks.market.owl;


import lombok.Data;

import java.math.BigDecimal;

@Data
public class PartOutValue {
    private String boid;
    private String catNamePath;
    private BigDecimal newCost;
    private BigDecimal usedCost;
    private BigDecimal newSold;
    private BigDecimal usedSold;
}
