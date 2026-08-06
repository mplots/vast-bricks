package com.vastbricks.integration.bricklink;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.config.Env;
import lombok.RequiredArgsConstructor;
import oauth.signpost.commonshttp.CommonsHttpOAuthConsumer;
import oauth.signpost.exception.OAuthCommunicationException;
import oauth.signpost.exception.OAuthExpectationFailedException;
import oauth.signpost.exception.OAuthMessageSignerException;
import org.apache.commons.lang3.StringUtils;
import org.apache.http.client.methods.HttpGet;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.util.List;

@Component
@RequiredArgsConstructor
public class LinkAPIClient {
    private static final URI API_BASE_URI = URI.create("https://api.bricklink.com/api/store/v1/");

    private final Env env;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Returns BrickLink's Get Orders response body without parsing or transforming its JSON.
     */
    public String getOrdersRaw() {
        return get("/orders");
    }

    public LinkAPIResponse<List<LinkOrder>> getOrders() {
        return deserialize(
            getOrdersRaw(),
            new TypeReference<LinkAPIResponse<List<LinkOrder>>>() { },
            "/orders"
        );
    }

    /**
     * Returns BrickLink's Get Order response body without parsing or transforming its JSON.
     */
    public String getOrderRaw(long orderId) {
        if (orderId <= 0) {
            throw new IllegalArgumentException("orderId must be positive");
        }
        return get("/orders/" + orderId);
    }

    public LinkAPIResponse<LinkOrder> getOrder(long orderId) {
        return deserialize(
            getOrderRaw(orderId),
            new TypeReference<LinkAPIResponse<LinkOrder>>() { },
            "/orders/" + orderId
        );
    }

    private String get(String subpath) {
        validateCredentials();

        var uri = API_BASE_URI.resolve(StringUtils.removeStart(subpath, "/"));
        var headers = new HttpHeaders();
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        authenticate(headers, uri);
        var request = new HttpEntity<Void>(headers);

        try {
            return restTemplate.exchange(
                uri,
                HttpMethod.GET,
                request,
                String.class
            ).getBody();
        } catch (HttpStatusCodeException ex) {
            throw new LinkInternalClientException(
                "BrickLink API request to " + subpath + " failed with HTTP " + ex.getStatusCode().value(),
                ex
            );
        } catch (RestClientException ex) {
            throw new LinkInternalClientException("BrickLink API request to " + subpath + " failed", ex);
        }
    }

    private void authenticate(HttpHeaders headers, URI uri) {
        var consumer = new CommonsHttpOAuthConsumer(
            env.getBrickLinkConsumerKey().trim(),
            env.getBrickLinkConsumerSecret().trim()
        );
        consumer.setTokenWithSecret(
            env.getBrickLinkToken().trim(),
            env.getBrickLinkTokenSecret().trim()
        );
        var signedRequest = new HttpGet(uri);
        try {
            consumer.sign(signedRequest);
        } catch (OAuthCommunicationException | OAuthMessageSignerException | OAuthExpectationFailedException ex) {
            throw new LinkInternalClientException("Could not authenticate BrickLink API request", ex);
        }
        for (var header : signedRequest.getAllHeaders()) {
            headers.set(header.getName(), header.getValue());
        }
    }

    private <T> T deserialize(String json, TypeReference<T> type, String subpath) {
        if (StringUtils.isBlank(json)) {
            throw new LinkInternalClientException("BrickLink API request to " + subpath + " returned an empty response");
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException ex) {
            throw new LinkInternalClientException(
                "Could not deserialize BrickLink API response from " + subpath,
                ex
            );
        }
    }

    private void validateCredentials() {
        if (StringUtils.isAnyBlank(
            env.getBrickLinkConsumerKey(),
            env.getBrickLinkConsumerSecret(),
            env.getBrickLinkToken(),
            env.getBrickLinkTokenSecret()
        )) {
            throw new LinkAuthenticationException("BrickLink API credentials are not configured");
        }
    }
}
