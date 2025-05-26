package com.vastbricks.market.link;

import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.lang.Nullable;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.InetSocketAddress;
import java.net.Proxy;
import java.net.Socket;
import java.util.Map;
import java.util.concurrent.TimeoutException;

@Slf4j
public class TorRestTemplate {

    private static final Integer NEW_IP_MAX_WAIT_SECONDS = 100;
    private static final Integer MAX_REQUESTS_BEFORE_REQUESTING_NEW_IP = 50;
    private static final Integer MAX_403_ATTEMPTS = 200;
    private Integer performedRequests = 0;

    public <T> ResponseEntity<T> exchange(String url, HttpMethod method, @Nullable HttpEntity<?> requestEntity, Class<T> responseType, Object... uriVariables) throws RestClientException {
        var attempt403 = 0;
        while (attempt403 < MAX_403_ATTEMPTS) {
            try {
                if (performedRequests > MAX_REQUESTS_BEFORE_REQUESTING_NEW_IP)  {
                    performedRequests = 0;
                    requestNewTorCircuit(false);
                }
                performedRequests++;
                return getRestTemplate().exchange(url, method, requestEntity, responseType);
            } catch (HttpClientErrorException.Forbidden e) {
                log.warn("Forbidden using current tor circuit retrying...");
                requestNewTorCircuit(true);
                attempt403 ++;
            }
        }
        throw new HttpStatusCodeException(HttpStatusCode.valueOf(403)){};
    }


    public <T> ResponseEntity<T> getForEntity(String url, Class<T> responseType, Map<String, ?> uriVariables) throws RestClientException {
        var attempt403 = 0;
        while (attempt403 < MAX_403_ATTEMPTS) {
            try {
                if (performedRequests > MAX_REQUESTS_BEFORE_REQUESTING_NEW_IP)  {
                    performedRequests = 0;
                    requestNewTorCircuit(false);
                }
                performedRequests++;
                return getRestTemplate().getForEntity(url, responseType, uriVariables);
            } catch (HttpClientErrorException.Forbidden e) {
                log.warn("Forbidden using current tor circuit retrying...");
                requestNewTorCircuit(true);
                attempt403 ++;
            }
        }
        throw new HttpStatusCodeException(HttpStatusCode.valueOf(403)){};
    }

    private RestTemplate getRestTemplate() {
        var factory = new SimpleClientHttpRequestFactory();
        var proxy = new Proxy(Proxy.Type.HTTP, new InetSocketAddress("localhost", 8118));
        factory.setProxy(proxy);

        var template =  new RestTemplate(factory);

        template.getInterceptors().add((request, body, execution) -> {
            request.getHeaders().remove(HttpHeaders.COOKIE);
            request.getHeaders().add("Connection", "close");
            request.getHeaders().set("Cache-Control", "no-cache");
            return execution.execute(request, body);
        });
        return template;
    }


    @SneakyThrows
    private void requestNewTorCircuit(boolean wait){
        try (Socket socket = new Socket("localhost", 9051);
             var out = new PrintWriter(socket.getOutputStream(), true);
             var in = new BufferedReader(new InputStreamReader(socket.getInputStream()))) {

            var currentIp = getIpAddress();
            // Authenticate (If password authentication is required, send "AUTHENTICATE \"your_password\"")
            out.println("AUTHENTICATE \"yourpass\"");
            out.flush();
            var response = in.readLine();
            if (!response.startsWith("250")) {
                System.err.println("Authentication failed: " + response);
                return;
            }

            // Request a new circuit
            out.println("SIGNAL NEWNYM");
            out.println("SIGNAL FLUSHALL");
            out.flush();
            response = in.readLine();
            if (response.startsWith("250")) {
                log.info("New Tor circuit requested successfully.%s".formatted(wait ? " Waiting for new ip..." : ""));
                if (wait) {
                    var newIp = getIpAddress();
                    int attempts = 0;
                    while (currentIp.equals(getIpAddress())) {
                        attempts++;
                        Thread.sleep(1000);
                        if (attempts>= NEW_IP_MAX_WAIT_SECONDS) {
                            throw new TimeoutException();
                        }
                    }
                    log.info("New Ip Assigned: %s".formatted(newIp));
                }
            } else {
                log.error("Failed to request new circuit: %s".formatted(response));
            }


        } catch (IOException e) {
            log.error(e.getMessage(), e);
        }
    }

    private String getIpAddress() {
        return (String) getRestTemplate().getForEntity("https://check.torproject.org/api/ip", Map.class).getBody().get("IP");
    }
}
