package com.vastbricks.bsx;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class Item {

    @JacksonXmlProperty(localName = "ItemID")
    private String itemId;

    @JacksonXmlProperty(localName = "ItemTypeID")
    private String itemTypeId;

    @JacksonXmlProperty(localName = "ColorID")
    private Integer colorId;

    @JacksonXmlProperty(localName = "ItemName")
    private String itemName;

    @JacksonXmlProperty(localName = "ItemTypeName")
    private String itemTypeName;

    @JacksonXmlProperty(localName = "ColorName")
    private String colorName;

    @JacksonXmlProperty(localName = "Status")
    private String status;

    @JacksonXmlProperty(localName = "Qty")
    private Integer qty;

    @JacksonXmlProperty(localName = "OrigQty")
    private Integer origQty;

    @JacksonXmlProperty(localName = "Price")
    private BigDecimal price;

    @JacksonXmlProperty(localName = "SalePrice")
    private BigDecimal salePrice;

    @JacksonXmlProperty(localName = "Condition")
    private String condition;

    @JacksonXmlProperty(localName = "Remarks")
    private String remarks;

    @JacksonXmlProperty(localName = "LotID")
    private String lotId;
}
