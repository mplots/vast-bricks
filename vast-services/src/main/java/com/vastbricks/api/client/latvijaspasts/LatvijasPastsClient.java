package com.vastbricks.api.client.latvijaspasts;

import com.vastbricks.api.client.HttpExchangeCapture;
import java.util.List;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * The Latvijas Pasts tariff calculator, as it is reached behind {@code mans.pasts.lv}.
 *
 * <p>Anonymous throughout. There is no key and no session, which is the whole reason this client is so much smaller
 * than the one that signs into the shipment register - and also why what it reads is the public self-service price
 * rather than an account's contract pricing. Nothing is masked in a recorded exchange because nothing secret is sent.
 *
 * <p>Two calls and no more: the destinations there are prices for, and the prices for up to five of them at a time.
 */
@Component
public class LatvijasPastsClient {

    private static final String PROVIDER = "Latvijas Pasts";
    private static final String COUNTRIES_PATH = "/api/public/countries?active=true&itemsPerPage=300";
    private static final String PRICES_PATH = "/api/public/prices/by_country";

    /** The provider will price at most this many destinations in one request, and says so if asked for more. */
    public static final int MAX_COUNTRIES_PER_REQUEST = 5;

    private final LatvijasPastsSettings settings;
    private final HttpExchangeCapture capture;
    private final RestClient restClient;

    LatvijasPastsClient(LatvijasPastsSettings settings, HttpExchangeCapture capture) {
        this.settings = settings;
        this.capture = capture;
        this.restClient = RestClient.builder()
                .requestFactory(new SimpleClientHttpRequestFactory())
                .requestInterceptor(HttpExchangeCapture.interceptor())
                .build();
    }

    /** Every destination the calculator currently prices. */
    public List<LatvijasPastsCountry> listCountries() {
        return capture.record(PROVIDER, List.of(), () -> {
            LatvijasPastsCountriesResponse response = get(COUNTRIES_PATH, LatvijasPastsCountriesResponse.class);
            if (response == null || response.getMembers() == null) {
                throw new LatvijasPastsClientException("Latvijas Pasts stated no destinations");
            }
            return response.getMembers().stream().filter(LatvijasPastsCountry::isActive).toList();
        });
    }

    /**
     * What it costs to send {@code weightGrams} to each of the stated destinations.
     *
     * <p>A weight heavier than anything the provider carries is not an error to it: asked about one, it answers with
     * every band of every way of sending rather than with the single price it was asked for. That is how a whole
     * country's tariff is read in one request, and it is why the sweep never asks about a realistic weight.
     */
    public LatvijasPastsPriceResponse pricesByCountry(List<String> countryCodes, int weightGrams) {
        if (countryCodes == null || countryCodes.isEmpty()) {
            throw new IllegalArgumentException("At least one destination must be stated");
        }
        if (countryCodes.size() > MAX_COUNTRIES_PER_REQUEST) {
            throw new IllegalArgumentException(
                    "Latvijas Pasts prices at most " + MAX_COUNTRIES_PER_REQUEST + " destinations in one request"
            );
        }

        Map<String, Object> body = Map.of(
                "shipmentType", "parcel",
                "countryCodes", countryCodes,
                "weight", weightGrams,
                // Contract pricing needs a signed-in account; asked for anonymously it prices nothing at all.
                "withContract", false
        );

        return capture.record(PROVIDER, List.of(), () -> {
            LatvijasPastsPriceResponse response = post(PRICES_PATH, body, LatvijasPastsPriceResponse.class);
            if (response == null) {
                throw new LatvijasPastsClientException("Latvijas Pasts stated no prices for " + countryCodes);
            }
            return response;
        });
    }

    private <T> T get(String path, Class<T> responseType) {
        try {
            return restClient.get().uri(url(path)).retrieve().body(responseType);
        } catch (RestClientException exception) {
            throw new LatvijasPastsClientException("Latvijas Pasts request failed", exception);
        }
    }

    private <T> T post(String path, Object body, Class<T> responseType) {
        try {
            return restClient.post()
                    .uri(url(path))
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(responseType);
        } catch (RestClientException exception) {
            throw new LatvijasPastsClientException("Latvijas Pasts request failed", exception);
        }
    }

    private String url(String path) {
        String baseUrl = settings.getBaseUrl();
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new LatvijasPastsClientException("Latvijas Pasts base URL is not configured");
        }
        return baseUrl.replaceAll("/+$", "") + path;
    }

    /** How long a sweep waits between requests, so pacing is the provider's setting rather than the job's opinion. */
    public int requestDelayMillis() {
        return Math.max(0, settings.getRequestDelayMillis());
    }
}
