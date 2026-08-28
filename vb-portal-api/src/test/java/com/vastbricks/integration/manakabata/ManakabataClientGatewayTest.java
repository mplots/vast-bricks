package com.vastbricks.integration.manakabata;

import com.vastbricks.integration.manakabata.client.model.ClientIndex200Response;
import com.vastbricks.integration.manakabata.client.model.ClientResource;
import com.vastbricks.integration.manakabata.client.model.InvoiceIndex200ResponseMeta;
import com.vastbricks.integration.manakabata.client.model.PersonTypeEnum;
import com.vastbricks.integration.manakabata.client.model.StoreClientRequest;
import com.vastbricks.integration.manakabata.client.model.UpdateClientRequest;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ManakabataClientGatewayTest {

    @Test
    void createsClientAfterSearchingEveryPage() {
        var listCalls = new ArrayList<List<Integer>>();
        var clientUuid = UUID.randomUUID();
        var gateway = new ManakabataClientGateway(
            ignored -> new ClientResource().uuid(clientUuid.toString()),
            (ignoredUuid, ignoredRequest) -> null,
            (page, perPage) -> {
                listCalls.add(List.of(page, perPage));
                return page(page, 2, new ClientResource().referenceId("some-other-reference"));
            }
        );

        var client = gateway.upsertClient(clientRequest("bricklink:customer:new-buyer", "New Buyer"));

        assertEquals(clientUuid.toString(), client.getUuid());
        assertEquals(
            List.of(
                List.of(1, ManakabataClientGateway.CLIENTS_PER_PAGE),
                List.of(2, ManakabataClientGateway.CLIENTS_PER_PAGE)
            ),
            listCalls
        );
    }

    @Test
    void updatesClientFoundByReferenceIdOnLaterPage() {
        var clientUuid = UUID.randomUUID();
        var createCalls = new AtomicInteger();
        var updatedUuid = new AtomicReference<UUID>();
        var updatedRequest = new AtomicReference<UpdateClientRequest>();
        var gateway = new ManakabataClientGateway(
            ignored -> {
                createCalls.incrementAndGet();
                return null;
            },
            (uuid, request) -> {
                updatedUuid.set(uuid);
                updatedRequest.set(request);
                return new ClientResource().uuid(uuid.toString());
            },
            (page, ignoredPerPage) -> page == 1
                ? page(1, 2, new ClientResource().referenceId("some-other-reference"))
                : page(2, 2, new ClientResource()
                    .uuid(clientUuid.toString())
                    .referenceId("brickowl:customer:42"))
        );

        gateway.upsertClient(clientRequest("brickowl:customer:42", "Updated Buyer"));

        assertEquals(0, createCalls.get());
        assertEquals(clientUuid, updatedUuid.get());
        assertEquals("brickowl:customer:42", updatedRequest.get().getReferenceId());
        assertEquals("Updated Buyer", updatedRequest.get().getName());
        assertEquals(PersonTypeEnum.PERSON, updatedRequest.get().getType());
    }

    private ClientIndex200Response page(int currentPage, int lastPage, ClientResource... clients) {
        return new ClientIndex200Response()
            .data(List.of(clients))
            .meta(new InvoiceIndex200ResponseMeta()
                .currentPage(currentPage)
                .lastPage(lastPage));
    }

    private StoreClientRequest clientRequest(String referenceId, String name) {
        return new StoreClientRequest()
            .referenceId(referenceId)
            .type(PersonTypeEnum.PERSON)
            .name(name)
            .isSelfEmployed(false)
            .isVatSpecial(false);
    }
}
