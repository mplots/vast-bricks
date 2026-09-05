package com.vastbricks.api.client.paypal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.vastbricks.api.client.HttpExchangeCapture;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * PayPal transport. It reports the transactions of a period through PayPal's transaction search, following its page
 * numbering so its callers see one flat list, and decides nothing about what a transaction means.
 *
 * <p>Written on {@link RestClient} rather than on PayPal's own SDK because that SDK addresses its two hosts through a
 * {@code SANDBOX}/{@code PRODUCTION} enum and accepts no other base URL, which leaves it untestable against a mocked
 * provider. The sandbox is simply another base URL here.
 */
@Component
public class PayPalClient {

    private static final int PAGE_SIZE = 500;

    /** Pages requested at most, so a provider that keeps reporting more pages fails instead of looping forever. */
    private static final int MAX_PAGES = 100;

    private static final String PROVIDER = "PayPal";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper().registerModule(new JavaTimeModule());

    private final PayPalSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;

    PayPalClient(PayPalSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .messageConverters(converters -> converters.addFirst(
                        new MappingJackson2HttpMessageConverter(OBJECT_MAPPER)
                ))
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /**
     * Every transaction PayPal reports for the period, both ends included. One recorded operation covers the
     * client-credentials token request and one search request per page PayPal reports.
     */
    public List<PayPalTransaction> listTransactions(Instant from, Instant to) {
        return capture.record(
                PROVIDER,
                List.of(
                        required("PayPal client id", settings.getClientId()),
                        required("PayPal client secret", settings.getClientSecret())
                ),
                () -> collectTransactions(from, to)
        );
    }

    private List<PayPalTransaction> collectTransactions(Instant from, Instant to) {
        var accessToken = accessToken();
        var transactions = new ArrayList<PayPalTransaction>();

        for (var page = 1; page <= MAX_PAGES; page++) {
            var response = searchTransactions(accessToken, from, to, page);
            if (response == null || response.getTransactionDetails() == null) {
                return List.copyOf(transactions);
            }
            transactions.addAll(response.getTransactionDetails());
            if (response.getTotalPages() == null || page >= response.getTotalPages()) {
                return List.copyOf(transactions);
            }
        }
        throw new PayPalClientException(
                "PayPal reports more than the " + MAX_PAGES + " transaction pages a request can collect"
        );
    }

    private PayPalTransactionsResponse searchTransactions(String accessToken, Instant from, Instant to, int page) {
        try {
            return restClient.get()
                    .uri(
                            url("/v1/reporting/transactions")
                                    + "?start_date={startDate}&end_date={endDate}&fields=all"
                                    + "&balance_affecting_records_only=Y&page_size={pageSize}&page={page}",
                            Map.of(
                                    "startDate", DateTimeFormatter.ISO_INSTANT.format(from),
                                    "endDate", DateTimeFormatter.ISO_INSTANT.format(to),
                                    "pageSize", PAGE_SIZE,
                                    "page", page
                            )
                    )
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                    .retrieve()
                    .body(PayPalTransactionsResponse.class);
        } catch (RestClientException exception) {
            throw new PayPalClientException("PayPal transaction search failed", exception);
        }
    }

    /**
     * A client-credentials access token, requested per call. PayPal issues these with a lifetime of hours, but a
     * cached one would outlive the settings it was requested with, and one token request per reconciled month is not
     * worth that.
     */
    private String accessToken() {
        var form = new LinkedMultiValueMap<String, String>();
        form.add("grant_type", "client_credentials");

        PayPalTokenResponse response;
        try {
            response = restClient.post()
                    .uri(url("/v1/oauth2/token"))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .headers(headers -> headers.setBasicAuth(
                            required("PayPal client id", settings.getClientId()),
                            required("PayPal client secret", settings.getClientSecret())
                    ))
                    .body(form)
                    .retrieve()
                    .body(PayPalTokenResponse.class);
        } catch (RestClientException exception) {
            throw new PayPalClientException("PayPal authentication failed", exception);
        }

        if (response == null || response.getAccessToken() == null || response.getAccessToken().isBlank()) {
            throw new PayPalClientException("PayPal returned no access token");
        }
        // The token is a credential of its own, and the response that issued it has already been recorded.
        HttpExchangeCapture.mask(response.getAccessToken());
        return response.getAccessToken();
    }

    private String url(String path) {
        var baseUrl = required("PayPal base URL", settings.getBaseUrl());
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) + path : baseUrl + path;
    }

    private String required(String name, String value) {
        if (value == null || value.isBlank()) {
            throw new PayPalClientException(name + " is not configured");
        }
        return value.trim();
    }
}
