package com.vastbricks.integration.bricklink;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlRootElement;
import lombok.Data;

import java.util.List;

@Data
@JacksonXmlRootElement(localName = "ORDERS")
public class LinkOrderExport {
    @JacksonXmlProperty(localName = "ORDER")
    @JacksonXmlElementWrapper(useWrapping = false)
    private List<LinkOrderSummary> orders;
}
