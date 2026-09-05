package com.vastbricks.api.client.manakabata;

import com.vastbricks.api.client.HttpExchangeCapture;
import com.vastbricks.api.client.manakabata.api.ClientsApi;
import com.vastbricks.api.client.manakabata.api.InvoicesApi;
import com.vastbricks.api.client.manakabata.model.ClientIndex200Response;
import com.vastbricks.api.client.manakabata.model.ClientResource;
import com.vastbricks.api.client.manakabata.model.ClientStore200Response;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200Response;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import com.vastbricks.api.client.manakabata.model.InvoiceResource;
import com.vastbricks.api.client.manakabata.model.InvoiceStore200Response;
import com.vastbricks.api.client.manakabata.model.StoreClientRequest;
import com.vastbricks.api.client.manakabata.model.UpdateClientRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

/**
 * Talks to the Manakabata accounting API: invoices and the clients they are issued to. Requests are built from the
 * generated client, apart from creating an invoice, whose payload the published specification types wrongly; see
 * {@link ManakabataInvoiceRequest}. What an invoice says is decided by the invoice feature, not here.
 */
@Component
@RequiredArgsConstructor
public class ManakabataClient {

    private static final String PROVIDER = "Manakabata";

    private static final int INVOICES_PER_PAGE = 1000;
    private static final int CLIENTS_PER_PAGE = 1000;
    private static final int MESSAGE_BODY_LIMIT = 1000;

    private final ManakabataSettings settings;
    private final HttpExchangeCapture capture;

    /** The invoice list accepts no filter beyond the page size, so a list longer than one page is rejected. */
    public List<InvoiceIndex200ResponseDataInner> listInvoices() {
        return capture.record(PROVIDER, List.of(apiToken()), this::collectInvoices);
    }

    private List<InvoiceIndex200ResponseDataInner> collectInvoices() {
        var response = call(() -> new InvoicesApi(apiClient()).invoiceIndex(INVOICES_PER_PAGE));
        if (response == null || response.getData() == null) {
            throw new ManakabataClientException("Manakabata invoice list response is empty");
        }
        rejectTruncatedInvoices(response);
        return response.getData();
    }

    public InvoiceResource createInvoice(ManakabataInvoiceRequest request) {
        var response = call(() -> restClient()
                .post()
                .uri("/invoices")
                .body(request)
                .retrieve()
                .body(InvoiceStore200Response.class));
        var invoice = response == null ? null : response.getData();
        if (invoice == null) {
            throw new ManakabataClientException("Manakabata returned no invoice data");
        }
        return invoice;
    }

    /** The client list accepts no filter either, so the reference is searched for page by page. */
    public Optional<ClientResource> findClientByReferenceId(String referenceId) {
        if (referenceId == null || referenceId.isBlank()) {
            throw new ManakabataClientException("Manakabata client reference_id is required");
        }

        var clientsApi = new ClientsApi(apiClient());
        var page = 1;
        while (true) {
            var currentPage = page;
            var response = call(() -> clientsApi.clientIndex(CLIENTS_PER_PAGE, currentPage));
            if (response == null) {
                throw new ManakabataClientException("Manakabata returned no client list data for page " + page);
            }

            var clients = response.getData() == null ? List.<ClientResource>of() : response.getData();
            var match = clients.stream()
                    .filter(client -> client != null && referenceId.equals(client.getReferenceId()))
                    .findFirst();
            if (match.isPresent()) {
                return match;
            }
            if (lastPage(response, page, clients.size())) {
                return Optional.empty();
            }
            page++;
        }
    }

    public ClientResource createClient(StoreClientRequest request) {
        return requiredClient(call(() -> responseData(new ClientsApi(apiClient()).clientStore(request))));
    }

    /** Updates an existing client. The API takes its own request shape for an update, so the payload is remapped. */
    public ClientResource updateClient(ClientResource client, StoreClientRequest request) {
        var uuid = clientUuid(client);
        return requiredClient(call(() -> responseData(
                new ClientsApi(apiClient()).clientUpdate(uuid, updateRequest(request))
        )));
    }

    private void rejectTruncatedInvoices(InvoiceIndex200Response response) {
        var meta = response.getMeta();
        if (meta != null && meta.getTotal() != null && meta.getTotal() > INVOICES_PER_PAGE) {
            throw new ManakabataClientException(
                    "Manakabata has " + meta.getTotal() + " invoices, more than the " + INVOICES_PER_PAGE
                            + " a single page can return"
            );
        }
    }

    private boolean lastPage(ClientIndex200Response response, int page, int pageSize) {
        var meta = response.getMeta();
        if (meta != null && meta.getLastPage() != null) {
            return page >= meta.getLastPage();
        }
        return pageSize < CLIENTS_PER_PAGE;
    }

    /**
     * The generated invoker. The specification declares no security scheme, so the generated methods send no
     * credentials of their own and the token is added here as a default header.
     */
    private ApiClient apiClient() {
        // The generated invoker takes a RestClient, which is where the capture is installed for the generated calls.
        return new ApiClient(capturing(ApiClient.buildRestClientBuilder()).build())
                .setBasePath(baseUrl())
                .addDefaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken());
    }

    private RestClient restClient() {
        return capturing(ApiClient.buildRestClientBuilder())
                .baseUrl(baseUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken())
                .build();
    }

    private RestClient.Builder capturing(RestClient.Builder builder) {
        return builder.requestInterceptor(HttpExchangeCapture.interceptor());
    }

    private String baseUrl() {
        var baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new ManakabataClientException("Manakabata base URL is not configured");
        }
        baseUrl = baseUrl.trim();
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    private String apiToken() {
        var apiToken = settings.getApiToken();
        if (apiToken == null || apiToken.isBlank()) {
            throw new ManakabataClientException("Manakabata API token is not configured");
        }
        return apiToken.trim();
    }

    private <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientResponseException ex) {
            throw new ManakabataClientException(responseMessage(ex), ex);
        } catch (RestClientException ex) {
            throw new ManakabataClientException("Manakabata request failed", ex);
        }
    }

    private String responseMessage(RestClientResponseException ex) {
        var message = "Manakabata returned HTTP " + ex.getStatusCode().value();
        var body = ex.getResponseBodyAsString().trim();
        if (body.isEmpty()) {
            return message;
        }
        if (body.length() > MESSAGE_BODY_LIMIT) {
            body = body.substring(0, MESSAGE_BODY_LIMIT - 3) + "...";
        }
        return message + ": " + body;
    }

    private ClientResource requiredClient(ClientResource client) {
        if (client == null) {
            throw new ManakabataClientException("Manakabata returned no client data");
        }
        return client;
    }

    private ClientResource responseData(ClientStore200Response response) {
        return response == null ? null : response.getData();
    }

    private UUID clientUuid(ClientResource client) {
        if (client.getUuid() == null || client.getUuid().isBlank()) {
            throw new ManakabataClientException("Manakabata returned a client without a UUID");
        }
        try {
            return UUID.fromString(client.getUuid());
        } catch (IllegalArgumentException ex) {
            throw new ManakabataClientException(
                    "Manakabata returned an invalid client UUID: " + client.getUuid(), ex
            );
        }
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
