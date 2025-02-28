package com.vastbricks.webstore;

import com.vastbricks.jpa.entity.WebStore;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class WebSet {
    private Long number;
    private WebStore store;
    private String name;
    private BigDecimal price;
    private String link;
    private String image;
}
