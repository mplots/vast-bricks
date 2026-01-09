package com.vastbricks.bsx;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JacksonXmlRootElement(localName = "BrickStoreXML")
public class BrickStoreXml {

    @JacksonXmlProperty(localName = "Order")
    private Order order;

    @JacksonXmlProperty(localName = "Inventory")
    private Inventory inventory;

    @JacksonXmlProperty(localName = "GuiState")
    private GuiState guiState;
}
