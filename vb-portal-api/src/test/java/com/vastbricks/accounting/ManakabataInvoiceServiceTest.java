package com.vastbricks.accounting;

import com.vastbricks.integration.bricklink.LinkOrder;
import com.vastbricks.integration.manakabata.ManakabataInvoiceRequest;
import com.vastbricks.api.client.manakabata.model.ClientResource;
import com.vastbricks.api.client.manakabata.model.InvoiceResource;
import com.vastbricks.api.client.manakabata.model.PersonTypeEnum;
import com.vastbricks.api.client.manakabata.model.StoreClientRequest;
import com.vastbricks.market.owl.OrderView;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ManakabataInvoiceServiceTest {

    @Test
    void createsPersonFromBrickLinkBuyer() {
        var capturedRequest = new AtomicReference<StoreClientRequest>();
        var order = new LinkOrder();
        order.setBuyerName("brick-buyer");
        order.setDateOrdered("2026-08-25T10:15:30Z");
        var name = new LinkOrder.Name();
        name.setFull("Test Person");
        var address = new LinkOrder.Address();
        address.setName(name);
        var shipping = new LinkOrder.Shipping();
        shipping.setAddress(address);
        order.setShipping(shipping);
        var clientId = "client-uuid";
        var capturedInvoice = new AtomicReference<ManakabataInvoiceRequest>();
        var service = new ManakabataInvoiceService(
            ignored -> order,
            ignored -> null,
            request -> {
                capturedRequest.set(request);
                return new ClientResource().uuid(clientId);
            },
            request -> {
                capturedInvoice.set(request);
                return new InvoiceResource().uuid("invoice-uuid").invoiceNumber("PL-100");
            },
            "numerator-uuid",
            "bank-account-uuid"
        );

        var result = service.generateInvoice("32266548", "BrickLink");

        var request = capturedRequest.get();
        assertEquals(PersonTypeEnum.PERSON, request.getType());
        assertEquals("Test Person", request.getName());
        assertEquals("bricklink:customer:brick-buyer", request.getReferenceId());
        assertFalse(request.getIsSelfEmployed());
        assertFalse(request.getIsVatSpecial());
        assertEquals(clientId, result.getClientUuid());
        assertEquals("invoice-uuid", result.getInvoiceUuid());
        assertEquals("PL-100", result.getInvoiceNumber());
        assertEquals(LocalDate.of(2026, 8, 25), capturedInvoice.get().getInvoicedAt());
        assertEquals(clientId, capturedInvoice.get().getRecipient().getUuid());
        assertEquals("numerator-uuid", capturedInvoice.get().getInvoiceNumerator().getUuid());
        assertEquals("bank-account-uuid", capturedInvoice.get().getTeamBankAccount().getUuid());
        assertEquals("bricklink:32266548", capturedInvoice.get().getInvoiceNote());
    }

    @Test
    void createsPersonFromBrickOwlCustomer() {
        var capturedRequest = new AtomicReference<StoreClientRequest>();
        var order = new OrderView();
        order.setCustomerUserId("9876");
        order.setCustomerUsername("owl-buyer");
        order.setBillingFirstName("Owl");
        order.setBillingLastName("Person");
        order.setIsoOrderTime(LocalDateTime.of(2026, 8, 26, 12, 30));
        var capturedInvoice = new AtomicReference<ManakabataInvoiceRequest>();
        var service = new ManakabataInvoiceService(
            ignored -> null,
            ignored -> order,
            request -> {
                capturedRequest.set(request);
                return new ClientResource().uuid("owl-client-uuid");
            },
            request -> {
                capturedInvoice.set(request);
                return new InvoiceResource().uuid("owl-invoice-uuid").invoiceNumber("PL-101");
            },
            "numerator-uuid",
            "bank-account-uuid"
        );

        service.generateInvoice("3060526", "Brick Owl");

        var request = capturedRequest.get();
        assertEquals("Owl Person", request.getName());
        assertEquals("brickowl:customer:9876", request.getReferenceId());
        assertEquals(PersonTypeEnum.PERSON, request.getType());
        assertFalse(request.getIsSelfEmployed());
        assertFalse(request.getIsVatSpecial());
        assertEquals(LocalDate.of(2026, 8, 26), capturedInvoice.get().getInvoicedAt());
        assertEquals("brickowl:3060526", capturedInvoice.get().getInvoiceNote());
    }
}
