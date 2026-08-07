package com.vastbricks.integration.bricklink;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class LinkInternalClientXmlTest {
    private static final OrderExportRequest REQUEST = OrderExportRequest.all(OrderType.RECEIVED);

    @Test
    void downloadsAndParsesOrderSummaryXml() {
        var client = new StubLinkInternalClient("""
                <?xml version="1.0" encoding="UTF-8"?>
                <ORDERS>
                  <ORDER>
                    <ORDERID>32266548</ORDERID>
                    <ORDERDATE>8/6/2026</ORDERDATE>
                    <ORDERSTATUSCHANGED>8/7/2026</ORDERSTATUSCHANGED>
                    <BUYER>Buyer</BUYER>
                    <ORDERSHIPPING>6.24</ORDERSHIPPING>
                    <ORDERINSURANCE></ORDERINSURANCE>
                    <ORDERADDCHRG1>2.42</ORDERADDCHRG1>
                    <ORDERADDCHRG2></ORDERADDCHRG2>
                    <ORDERCREDIT></ORDERCREDIT>
                    <ORDERCREDITCOUPON></ORDERCREDITCOUPON>
                    <ORDERTOTAL>1.53</ORDERTOTAL>
                    <ORDERSALESTAX>0.00</ORDERSALESTAX>
                    <ORDERVAT>0.00</ORDERVAT>
                    <BASECURRENCYCODE>EUR</BASECURRENCYCODE>
                    <BASEGRANDTOTAL>10.19</BASEGRANDTOTAL>
                    <PAYCURRENCYCODE>EUR</PAYCURRENCYCODE>
                    <ORDERLOTS>3</ORDERLOTS>
                    <ORDERITEMS>3</ORDERITEMS>
                    <ORDERSTATUS>Packed</ORDERSTATUS>
                    <PAYMENTTYPE>Credit/Debit</PAYMENTTYPE>
                    <ORDERREMARKS></ORDERREMARKS>
                    <ORDERTRACKNO>TRACK123</ORDERTRACKNO>
                    <LOCATION>Sweden, Skåne</LOCATION>
                    <VATCHARGES>1.77</VATCHARGES>
                    <ITEM>
                      <ITEMID>3001</ITEMID>
                      <ITEMTYPE>P</ITEMTYPE>
                      <COLOR>5</COLOR>
                      <QTY>2</QTY>
                    </ITEM>
                  </ORDER>
                </ORDERS>
                """);

        var orders = client.listOrders(REQUEST);
        var order = orders.getFirst();

        assertEquals(1, orders.size());
        assertEquals(32266548L, order.getOrderId());
        assertEquals(LocalDate.of(2026, 8, 6), order.getOrderDate());
        assertEquals(LocalDate.of(2026, 8, 7), order.getOrderStatusChanged());
        assertEquals("Buyer", order.getBuyer());
        assertEquals(new BigDecimal("6.24"), order.getShipping());
        assertNull(order.getInsurance());
        assertEquals(new BigDecimal("2.42"), order.getAdditionalCharge1());
        assertNull(order.getAdditionalCharge2());
        assertNull(order.getCredit());
        assertNull(order.getCreditCoupon());
        assertEquals(new BigDecimal("1.53"), order.getTotal());
        assertEquals(new BigDecimal("0.00"), order.getSalesTax());
        assertEquals(new BigDecimal("0.00"), order.getVat());
        assertEquals("EUR", order.getBaseCurrencyCode());
        assertEquals(new BigDecimal("10.19"), order.getBaseGrandTotal());
        assertEquals("EUR", order.getPaymentCurrencyCode());
        assertEquals(3, order.getTotalLots());
        assertEquals(3, order.getTotalItems());
        assertEquals("Packed", order.getStatus());
        assertEquals("Credit/Debit", order.getPaymentType());
        assertEquals("", order.getRemarks());
        assertEquals("TRACK123", order.getTrackingNumber());
        assertEquals("Sweden, Skåne", order.getLocation());
        assertEquals(new BigDecimal("1.77"), order.getVatCharges());
    }

    @Test
    void returnsEmptyListForEmptyExport() {
        assertEquals(0, new StubLinkInternalClient(new byte[0]).listOrders(REQUEST).size());
    }

    @Test
    void reportsInvalidXml() {
        var client = new StubLinkInternalClient("not XML");

        var error = assertThrows(LinkInternalClientException.class, () -> client.listOrders(REQUEST));

        assertEquals("Could not parse BrickLink order export XML", error.getMessage());
    }

    @Test
    void rejectsNonXmlExportView() {
        var request = OrderExportRequest.builder()
                .orderType(OrderType.RECEIVED)
                .viewType("C")
                .build();

        var error = assertThrows(
                IllegalArgumentException.class,
                () -> new StubLinkInternalClient(new byte[0]).listOrders(request)
        );

        assertEquals("viewType must be X for an XML order export", error.getMessage());
    }

    private static class StubLinkInternalClient extends LinkInternalClient {
        private final byte[] xml;

        private StubLinkInternalClient(String xml) {
            this(xml.getBytes(StandardCharsets.UTF_8));
        }

        private StubLinkInternalClient(byte[] xml) {
            super(null, null);
            this.xml = xml;
        }

        @Override
        public byte[] exportOrders(OrderExportRequest request) {
            return xml;
        }
    }
}
