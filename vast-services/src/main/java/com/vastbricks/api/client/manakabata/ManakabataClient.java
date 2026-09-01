package com.vastbricks.api.client.manakabata;

import com.vastbricks.api.client.manakabata.api.InvoicesApi;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200Response;
import com.vastbricks.api.client.manakabata.model.InvoiceIndex200ResponseDataInner;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;

/**
 * Reads the Manakabata accounting invoices. The invoice list endpoint accepts no filter beyond the page size, so the
 * whole list is requested as one page and a longer list is rejected rather than silently truncated.
 */
@Component
@RequiredArgsConstructor
public class ManakabataClient {

    private static final int INVOICES_PER_PAGE = 1000;

    private final ManakabataSettings settings;

    public List<InvoiceIndex200ResponseDataInner> listInvoices() {
        var response = requestInvoices();
        if (response == null || response.getData() == null) {
            throw new ManakabataClientException("Manakabata invoice list response is empty");
        }

        var meta = response.getMeta();
        if (meta != null && meta.getTotal() != null && meta.getTotal() > INVOICES_PER_PAGE) {
            throw new ManakabataClientException(
                    "Manakabata has " + meta.getTotal() + " invoices, more than the " + INVOICES_PER_PAGE
                            + " a single page can return"
            );
        }
        return response.getData();
    }

    private InvoiceIndex200Response requestInvoices() {
        // The specification declares no security scheme, so the generated methods send no credentials of their own.
        var apiClient = new ApiClient()
                .setBasePath(baseUrl())
                .addDefaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken());
        try {
            return new InvoicesApi(apiClient).invoiceIndex(INVOICES_PER_PAGE);
        } catch (RestClientException ex) {
            throw new ManakabataClientException("Manakabata invoice list request failed", ex);
        }
    }

    private String apiToken() {
        var apiToken = settings.getApiToken();
        if (apiToken == null || apiToken.isBlank()) {
            throw new ManakabataClientException("Manakabata API token is not configured");
        }
        return apiToken.trim();
    }

    private String baseUrl() {
        var baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new ManakabataClientException("Manakabata base URL is not configured");
        }
        baseUrl = baseUrl.trim();
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
