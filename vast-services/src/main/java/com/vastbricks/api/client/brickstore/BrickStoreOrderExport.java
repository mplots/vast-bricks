package com.vastbricks.api.client.brickstore;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import java.util.List;
import lombok.Data;

@Data
@JacksonXmlRootElement(localName = "ORDERS")
class BrickStoreOrderExport {

    @JacksonXmlProperty(localName = "ORDER")
    @JacksonXmlElementWrapper(useWrapping = false)
    private List<BrickStoreOrder> orders;
}
