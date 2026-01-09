package com.vastbricks.bsx;

import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class Order {

    @JacksonXmlProperty(localName = "Service")
    private String service;

    @JacksonXmlProperty(localName = "OrderID")
    private String orderId;

    @JacksonXmlProperty(localName = "OrderDate")
    private Long orderDate;

    @JacksonXmlProperty(localName = "Customer")
    private String customer;

    @JacksonXmlProperty(localName = "SubTotal")
    private BigDecimal subTotal;

    @JacksonXmlProperty(localName = "GrandTotal")
    private BigDecimal grandTotal;

    @JacksonXmlProperty(localName = "Payment")
    private BigDecimal payment;

    @JacksonXmlProperty(localName = "Currency")
    private String currency;
}
