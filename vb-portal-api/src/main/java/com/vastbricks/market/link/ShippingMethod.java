package com.vastbricks.market.link;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ShippingMethod {

    private Method method;

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class Method {
        private List<Zone> zones;
        private List<Rate> rateTable;
        private List<TrackingRule> trackingRules;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class TrackingRule {
        private String action;
        private Integer type;
        private String arg1;
        private String arg2;
        @JsonProperty(access = JsonProperty.Access.READ_ONLY)
        private List<Integer> zones;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class Zone {
        private List<Country> countryList;
        private Integer id;
        private String name;
        private Integer maxDays;
        private Integer minDays;
        private Boolean everywhereElse;
        private String action;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class Country {
        private String code;
        private String name;
        private Long buyerCnt;
        private Integer continentId;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class Rate {
        private String action;
        private String upto;
        private List<Cost> costs;
    }

    @Data
    @Builder
    @AllArgsConstructor
    @NoArgsConstructor
    public static final class Cost {
        private Integer zoneId;
        private BigDecimal cost;
    }
}
