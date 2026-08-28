package com.vastbricks.api.tor;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.net.InetSocketAddress;
import java.net.Proxy;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class TorRestClientFactory {

    private static final Logger log = LoggerFactory.getLogger(TorRestClientFactory.class);

    private final TorSettings settings;
    private final ObjectProvider<TorCircuitService> torCircuitService;

    TorRestClientFactory(TorSettings settings, ObjectProvider<TorCircuitService> torCircuitService) {
        this.settings = settings;
        this.torCircuitService = torCircuitService;
    }

    public RestClient create() {
        return create(TorRestClientOptions.defaults(settings.getDefaultRetryStatuses()));
    }

    public RestClient create(TorRestClientOptions options) {
        var performedRequests = new AtomicInteger();
        return RestClient.builder()
                .requestFactory(requestFactory())
                .requestInterceptor(torInterceptor(options, performedRequests))
                .build();
    }

    private ClientHttpRequestFactory requestFactory() {
        var factory = new SimpleClientHttpRequestFactory();
        var proxy = new Proxy(
                Proxy.Type.HTTP,
                new InetSocketAddress(settings.getProxyHost(), settings.getProxyPort())
        );
        factory.setProxy(proxy);
        factory.setConnectTimeout(settings.getConnectTimeout());
        factory.setReadTimeout(settings.getReadTimeout());
        return factory;
    }

    private ClientHttpRequestInterceptor torInterceptor(
            TorRestClientOptions options,
            AtomicInteger performedRequests
    ) {
        return (request, body, execution) -> {
            prepareHeaders(options, request.getHeaders());

            var attempts = 0;
            HttpStatusCode lastRetryStatus = null;
            while (attempts < options.getMaxRetryAttempts()) {
                rotateCircuitAfterRequestLimit(options, performedRequests);

                var response = execution.execute(request, body);
                if (!options.getRetryStatuses().contains(response.getStatusCode())) {
                    return response;
                }

                lastRetryStatus = response.getStatusCode();
                response.close();
                log.warn("HTTP {} using current tor circuit, retrying...", lastRetryStatus.value());
                torCircuitService.getObject().requestNewCircuit(true);
                attempts++;
            }

            if (lastRetryStatus == null) {
                throw new TorCircuitException("Tor RestClient exhausted retries before executing the request.");
            }
            throw new HttpClientErrorException(lastRetryStatus);
        };
    }

    private void prepareHeaders(TorRestClientOptions options, HttpHeaders headers) {
        if (!options.isPreserveCookies()) {
            headers.remove(HttpHeaders.COOKIE);
        }
        headers.add(HttpHeaders.CONNECTION, "close");
        headers.setCacheControl("no-cache");
    }

    private void rotateCircuitAfterRequestLimit(
            TorRestClientOptions options,
            AtomicInteger performedRequests
    ) {
        if (options.getMaxRequestsBeforeNewCircuit() <= 0) {
            return;
        }

        if (performedRequests.incrementAndGet() > options.getMaxRequestsBeforeNewCircuit()) {
            performedRequests.set(0);
            torCircuitService.getObject().requestNewCircuit(false);
        }
    }
}
