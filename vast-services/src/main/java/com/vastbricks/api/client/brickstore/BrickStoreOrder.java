package com.vastbricks.api.client.brickstore;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlElementWrapper;
import com.fasterxml.jackson.dataformat.xml.annotation.JacksonXmlProperty;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class BrickStoreOrder {

    @JacksonXmlProperty(localName = "ORDERID")
    private Long orderId;

    @JacksonXmlProperty(localName = "ORDERDATE")
    @JsonDeserialize(using = BrickStoreOrderLocalDateDeserializer.class)
    private LocalDate orderDate;

    @JacksonXmlProperty(localName = "ORDERSTATUSCHANGED")
    @JsonDeserialize(using = BrickStoreOrderLocalDateDeserializer.class)
    private LocalDate orderStatusChanged;

    @JacksonXmlProperty(localName = "BUYER")
    private String buyer;

    @JacksonXmlProperty(localName = "ORDERSHIPPING")
    private BigDecimal shipping;

    @JacksonXmlProperty(localName = "ORDERINSURANCE")
    private BigDecimal insurance;

    @JacksonXmlProperty(localName = "ORDERADDCHRG1")
    private BigDecimal additionalCharge1;

    @JacksonXmlProperty(localName = "ORDERADDCHRG2")
    private BigDecimal additionalCharge2;

    @JacksonXmlProperty(localName = "ORDERCREDIT")
    private BigDecimal credit;

    @JacksonXmlProperty(localName = "ORDERCREDITCOUPON")
    private BigDecimal creditCoupon;

    @JacksonXmlProperty(localName = "ORDERTOTAL")
    private BigDecimal total;

    @JacksonXmlProperty(localName = "ORDERSALESTAX")
    private BigDecimal salesTax;

    @JacksonXmlProperty(localName = "ORDERVAT")
    private BigDecimal vat;

    @JacksonXmlProperty(localName = "BASECURRENCYCODE")
    private String baseCurrencyCode;

    @JacksonXmlProperty(localName = "BASEGRANDTOTAL")
    private BigDecimal baseGrandTotal;

    @JacksonXmlProperty(localName = "PAYCURRENCYCODE")
    private String paymentCurrencyCode;

    @JacksonXmlProperty(localName = "ORDERLOTS")
    private Integer totalLots;

    @JacksonXmlProperty(localName = "ORDERITEMS")
    private Integer totalItems;

    @JacksonXmlProperty(localName = "ORDERSTATUS")
    private String status;

    @JacksonXmlProperty(localName = "PAYMENTTYPE")
    private String paymentType;

    @JacksonXmlProperty(localName = "ORDERREMARKS")
    private String remarks;

    @JacksonXmlProperty(localName = "ORDERTRACKNO")
    private String trackingNumber;

    @JacksonXmlProperty(localName = "LOCATION")
    private String location;

    @JacksonXmlProperty(localName = "VATCHARGES")
    private BigDecimal vatCharges;

    @JacksonXmlProperty(localName = "ITEM")
    @JacksonXmlElementWrapper(useWrapping = false)
    private List<BrickStoreOrderItem> items;
}
