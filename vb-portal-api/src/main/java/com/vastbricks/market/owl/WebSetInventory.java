package com.vastbricks.market.owl;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class WebSetInventory {
    private Long number;
    private String title;
    private String link;

    private BigDecimal currentPriceNew;
    private BigDecimal currentPriceUsed;
    private BigDecimal pastPriceNew;
    private BigDecimal pastPriceUsed;

    private Integer currentPercentageNew;
    private Integer currentPercentageUsed;
    private Integer pastPercentageNew;
    private Integer pastPercentageUsed;
}
