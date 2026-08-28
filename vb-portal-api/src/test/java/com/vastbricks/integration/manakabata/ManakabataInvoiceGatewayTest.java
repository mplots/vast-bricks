package com.vastbricks.integration.manakabata;

import com.sun.net.httpserver.HttpServer;
import com.vastbricks.config.Env;
import org.junit.jupiter.api.Test;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManakabataInvoiceGatewayTest {

    @Test
    void postsInvoiceToConfiguredApiBaseUrlWithBearerToken() throws Exception {
        var authorization = new AtomicReference<String>();
        var requestBody = new AtomicReference<String>();
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/v1/invoices", exchange -> {
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            var response = "{\"data\":{\"uuid\":\"invoice-uuid\",\"invoice_number\":\"PL-102\"}}"
                .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            var env = new Env();
            setField(env, "manakabataApiToken", "test-token");
            setField(env, "manakabataApiBaseUrl", "http://127.0.0.1:" + server.getAddress().getPort() + "/api/v1/");

            var invoice = ManakabataInvoiceGateway.createInvoice(
                env,
                ManakabataInvoiceRequest.builder()
                    .invoiceCategory("product")
                    .invoiceType("bill_of_landing")
                    .build()
            );

            assertEquals("invoice-uuid", invoice.getUuid());
            assertEquals("PL-102", invoice.getInvoiceNumber());
            assertEquals("Bearer test-token", authorization.get());
            assertTrue(requestBody.get().contains("\"invoice_category\":\"product\""));
        } finally {
            server.stop(0);
        }
    }

    private void setField(Env env, String name, String value) throws Exception {
        var field = Env.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(env, value);
    }
}
