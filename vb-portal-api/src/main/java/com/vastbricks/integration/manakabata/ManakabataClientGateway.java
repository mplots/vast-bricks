package com.vastbricks.integration.manakabata;

import com.vastbricks.config.Env;
import com.vastbricks.integration.manakabata.client.ApiClient;
import com.vastbricks.integration.manakabata.client.api.ClientsApi;
import com.vastbricks.integration.manakabata.client.model.ClientIndex200Response;
import com.vastbricks.integration.manakabata.client.model.ClientStore200Response;
import com.vastbricks.integration.manakabata.client.model.ClientResource;
import com.vastbricks.integration.manakabata.client.model.StoreClientRequest;
import com.vastbricks.integration.manakabata.client.model.UpdateClientRequest;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.function.Supplier;

@Component
public class ManakabataClientGateway {
    static final int CLIENTS_PER_PAGE = 1000;

    private final Function<StoreClientRequest, ClientResource> createClient;
    private final BiFunction<UUID, UpdateClientRequest, ClientResource> updateClient;
    private final BiFunction<Integer, Integer, ClientIndex200Response> listClients;

    @Autowired
    public ManakabataClientGateway(Env env) {
        var clientsApi = clientsApi(env);
        this.createClient = request -> responseData(clientsApi.clientStore(request));
        this.updateClient = (uuid, request) -> responseData(clientsApi.clientUpdate(uuid, request));
        this.listClients = (page, perPage) -> clientsApi.clientIndex(perPage, page);
    }

    ManakabataClientGateway(
        Function<StoreClientRequest, ClientResource> createClient,
        BiFunction<UUID, UpdateClientRequest, ClientResource> updateClient,
        BiFunction<Integer, Integer, ClientIndex200Response> listClients
    ) {
        this.createClient = createClient;
        this.updateClient = updateClient;
        this.listClients = listClients;
    }

    public ClientResource upsertClient(StoreClientRequest request) {
        if (StringUtils.isBlank(request.getReferenceId())) {
            throw new IllegalArgumentException("Manakabata client reference_id is required");
        }

        var existingClient = findByReferenceId(request.getReferenceId());
        if (existingClient.isPresent()) {
            return requiredClient(call(() -> updateClient.apply(clientUuid(existingClient.get()), updateRequest(request))));
        }

        return requiredClient(call(() -> createClient.apply(request)));
    }

    private Optional<ClientResource> findByReferenceId(String referenceId) {
        var page = 1;
        while (true) {
            var currentPage = page;
            var response = call(() -> listClients.apply(currentPage, CLIENTS_PER_PAGE));
            if (response == null) {
                throw new IllegalStateException("Manakabata returned no client list data for page " + page);
            }

            var clients = response.getData() == null ? List.<ClientResource>of() : response.getData();
            var match = clients.stream()
                .filter(client -> client != null && referenceId.equals(client.getReferenceId()))
                .findFirst();
            if (match.isPresent()) {
                return match;
            }

            var meta = response.getMeta();
            if (meta != null && meta.getLastPage() != null) {
                if (page >= meta.getLastPage()) {
                    return Optional.empty();
                }
            } else if (clients.size() < CLIENTS_PER_PAGE) {
                return Optional.empty();
            }
            page++;
        }
    }

    private <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException ex) {
            throw new ManakabataApiException(ex);
        }
    }

    private UUID clientUuid(ClientResource client) {
        if (StringUtils.isBlank(client.getUuid())) {
            throw new IllegalStateException("Manakabata returned a client without a UUID");
        }
        try {
            return UUID.fromString(client.getUuid());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Manakabata returned an invalid client UUID: " + client.getUuid(), ex);
        }
    }

    private static ClientsApi clientsApi(Env env) {
        if (StringUtils.isBlank(env.getManakabataApiToken())) {
            throw new IllegalStateException("MANAKABATA_API_TOKEN is not configured");
        }

        var apiClient = new ApiClient()
            .setBasePath(env.getManakabataApiBaseUrl().trim())
            .addDefaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + env.getManakabataApiToken().trim());
        return new ClientsApi(apiClient);
    }

    private static ClientResource responseData(ClientStore200Response response) {
        return response == null ? null : response.getData();
    }

    private ClientResource requiredClient(ClientResource client) {
        if (client == null) {
            throw new IllegalStateException("Manakabata returned no client data");
        }
        return client;
    }

    private UpdateClientRequest updateRequest(StoreClientRequest request) {
        var update = new UpdateClientRequest()
            .referenceId(request.getReferenceId())
            .type(request.getType())
            .name(request.getName())
            .regNo(request.getRegNo())
            .vatNo(request.getVatNo())
            .address(request.getAddress())
            .isSelfEmployed(request.getIsSelfEmployed())
            .isVatSpecial(request.getIsVatSpecial())
            .isSyncEnabled(request.getIsSyncEnabled())
            .contactName(request.getContactName())
            .contactEmail(request.getContactEmail())
            .contactPhone(request.getContactPhone())
            .contactPhoneCountry(request.getContactPhoneCountry())
            .contactEAddress(request.getContactEAddress());
        if (request.getCountry() != null) {
            update.country(UpdateClientRequest.CountryEnum.fromValue(request.getCountry().getValue()));
        }
        return update;
    }
}
