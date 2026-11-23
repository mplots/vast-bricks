package com.vastbricks.partfinder;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/** A set for sale that contains the part, with every store selling it, cheapest first. */
@Data
@AllArgsConstructor
public class SetForSale {
    private long setNumber;
    private String setName;
    private String theme;
    private Integer pieces;
    private int partQty;
    private String image;
    private List<StoreOffer> stores;

    @Data
    @AllArgsConstructor
    public static class StoreOffer {
        private String webStore;
        private BigDecimal price;
        private String link;
        private String seenAt;
    }
}
