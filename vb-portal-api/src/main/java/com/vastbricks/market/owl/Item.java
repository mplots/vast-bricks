package com.vastbricks.market.owl;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class Item extends ListItem {
    private String name;

    private ItemType type;

    private List<Id> ids;

    private String url;

    private List<Image> images;

    @JsonProperty("color_name")
    private String colorName;

    @JsonProperty("color_id")
    private Integer colorId;

    @JsonProperty("color_hex")
    private String colorHex;

    @JsonProperty("cheapest_gbp")
    private BigDecimal cheapestGbp;

    @JsonProperty("cat_name_path")
    private String catNamePath;

    @JsonProperty("missing_data")
    private String missingData;

    @JsonProperty("delete_scheduled")
    private Boolean deleteScheduled;

}
