package com.vastbricks.config;

import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

public class LoggingInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
        logRequest(request, body);
        ClientHttpResponse response = execution.execute(request, body);
        logResponse(response);
        return response;
    }

    private void logRequest(HttpRequest request, byte[] body) {
        System.out.println("=== HTTP REQUEST ===");
        System.out.println("URI: " + request.getURI());
        System.out.println("Method: " + request.getMethod());
        System.out.println("Headers: " + request.getHeaders());
        System.out.println("Body: " + new String(body, StandardCharsets.UTF_8));
    }

    private void logResponse(ClientHttpResponse response) throws IOException {
        System.out.println("=== HTTP RESPONSE ===");
        System.out.println("Status Code: " + response.getStatusCode());
        System.out.println("Headers: " + response.getHeaders());

        BufferedReader reader = new BufferedReader(new InputStreamReader(response.getBody(), StandardCharsets.UTF_8));
        String responseBody = reader.lines().collect(Collectors.joining("\n"));

        System.out.println("Body: " + responseBody);
    }
}
