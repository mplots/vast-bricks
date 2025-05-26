package com.vastbricks.market.link;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class PartOutValue {
    private BigDecimal last6monthsSalesAvg;
    private String link;
    private Integer pieces;
    private Integer lots;
}
