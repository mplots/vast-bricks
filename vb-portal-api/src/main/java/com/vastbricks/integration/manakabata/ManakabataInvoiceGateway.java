package com.vastbricks.integration.manakabata;

import com.vastbricks.config.Env;
import com.vastbricks.integration.manakabata.client.ApiClient;
import com.vastbricks.integration.manakabata.client.model.InvoiceResource;
import com.vastbricks.integration.manakabata.client.model.InvoiceStore200Response;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;

import java.util.function.Function;

@Component
public class ManakabataInvoiceGateway {
    private final Function<ManakabataInvoiceRequest, InvoiceResource> createInvoice;

    @Autowired
    public ManakabataInvoiceGateway(Env env) {
        this(request -> createInvoice(env, request));
    }

    ManakabataInvoiceGateway(Function<ManakabataInvoiceRequest, InvoiceResource> createInvoice) {
        this.createInvoice = createInvoice;
    }

    public InvoiceResource createInvoice(ManakabataInvoiceRequest request) {
        final InvoiceResource invoice;
        try {
            invoice = createInvoice.apply(request);
        } catch (RestClientResponseException ex) {
            throw new ManakabataApiException(ex);
        }
        if (invoice == null) {
            throw new IllegalStateException("Manakabata returned no invoice data");
        }
        return invoice;
    }

    static InvoiceResource createInvoice(Env env, ManakabataInvoiceRequest request) {
        if (StringUtils.isBlank(env.getManakabataApiToken())) {
            throw new IllegalStateException("MANAKABATA_API_TOKEN is not configured");
        }

        var restClient = ApiClient.buildRestClientBuilder()
            .baseUrl(StringUtils.removeEnd(env.getManakabataApiBaseUrl().trim(), "/"))
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + env.getManakabataApiToken().trim())
            .build();
        var response = restClient
            .post()
            .uri("/invoices")
            .body(request)
            .retrieve()
            .body(InvoiceStore200Response.class);
        return response == null ? null : response.getData();
    }
}
