package com.vastbricks.market.link;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
public class Countries {

    private List<Country> countries;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static final class Country {
        private String strCountryID;
        private String strCountryName;
        private String n4CurrencyID;
        private String n4ContinentID;
        private String strContinentName;
        private String n4BuyerCnt;
        private Boolean bStateLevel;
    }
}
