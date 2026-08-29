package com.vastbricks.api.client.brickstore;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import java.math.BigDecimal;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickStoreOrderItem {

    @JacksonXmlProperty(localName = "ORDERITEMID")
    private Long orderItemId;

    @JacksonXmlProperty(localName = "ORDERBATCH")
    private Integer orderBatch;

    @JacksonXmlProperty(localName = "CATEGORY")
    private String category;

    @JacksonXmlProperty(localName = "COLOR")
    private String color;

    @JacksonXmlProperty(localName = "PRICE")
    private BigDecimal price;

    @JacksonXmlProperty(localName = "QTY")
    private Integer quantity;

    @JacksonXmlProperty(localName = "BULK")
    private Integer bulk;

    @JacksonXmlProperty(localName = "IMAGE")
    private String image;

    @JacksonXmlProperty(localName = "DESCRIPTION")
    private String description;

    @JacksonXmlProperty(localName = "CONDITION")
    private String condition;

    @JacksonXmlProperty(localName = "ITEMTYPE")
    private String itemType;

    @JacksonXmlProperty(localName = "ITEMID")
    private String itemId;

    @JacksonXmlProperty(localName = "SALE")
    private BigDecimal sale;

    @JacksonXmlProperty(localName = "REMARKS")
    private String remarks;

    @JacksonXmlProperty(localName = "WEIGHT")
    private BigDecimal weight;

    @JacksonXmlProperty(localName = "LOTID")
    private Long lotId;
}
