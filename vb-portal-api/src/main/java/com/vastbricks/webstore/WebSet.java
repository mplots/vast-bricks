package com.vastbricks.webstore;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WebSet {
    private Long number;
    private String store;
    private String name;
    private BigDecimal price;
    private String link;
    private String image;
}
