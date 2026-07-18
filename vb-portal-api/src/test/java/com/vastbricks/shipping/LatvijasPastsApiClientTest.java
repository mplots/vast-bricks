package com.vastbricks.shipping;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Disabled("Creates a real Mans Pasts package")
class LatvijasPastsApiClientTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void createsOrdinarySmallPackageParcelAndDownloadsReturnedDocumentLink() throws Exception {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {
                  "code": 201,
                  "message": "ok",
                  "packageId": 12345,
                  "addressBarcodes": ["RR123456789LV"],
                  "documents": [
                    {"documentType": "Address labels", "link": "https://api.test/download/label.pdf"}
                  ]
                }
                """);
        transport.respond(HttpStatus.OK, MediaType.APPLICATION_PDF, "%PDF-1.4 label");

        var client = client(transport);
        var result = client.createSmallPackageLabel(order(Tariff.Mode.SIMPLE));

        assertArrayEquals("%PDF-1.4 label".getBytes(StandardCharsets.UTF_8), result.pdf());
        assertEquals(12345, result.packageId());
        assertEquals("RR123456789LV", result.barcode());
        assertEquals(2, transport.requests.size());
        assertEquals(HttpMethod.POST, transport.requests.get(0).method());
        assertEquals(URI.create("https://api.test/api/packages"), transport.requests.get(0).uri());
        assertEquals(HttpMethod.GET, transport.requests.get(1).method());
        assertEquals(URI.create("https://api.test/download/label.pdf"), transport.requests.get(1).uri());

        var packageCreate = packageCreate(transport.requests.get(0).body());
        assertEquals("api-user", packageCreate.path("user").asText());
        assertEquals("api-key", packageCreate.path("api_key").asText());
        assertEquals("goods", packageCreate.path("type").asText());
        assertEquals("Parcel", packageCreate.path("itemType").asText());
        assertEquals("Ordinary", packageCreate.path("postageType").asText());
        assertTrue(packageCreate.path("weightTo").isMissingNode());

        var address = packageCreate.path("addresses").get(0);
        assertEquals("US", address.path("countryCode").asText());
        assertEquals("Main street 1, Apt 2", address.path("freeformAddressLine1").asText());
        assertEquals("CA, Los Angeles", address.path("freeformAddressLine2").asText());
        assertEquals("90001", address.path("postCode").asText());
        assertEquals("Jane Buyer", address.path("name").asText());
        assertEquals("Other", address.path("contentType").asText());
        assertEquals(350, address.path("userPackageWeight").asInt());
        assertTrue(address.path("commercial").asBoolean());

        var content = address.path("contentItems").get(0);
        assertEquals("Lego Set", content.path("name").asText());
        assertEquals("12", content.path("quantity").asText());
        assertEquals(350, content.path("weight").asInt());
        assertEquals("49.95", content.path("value").asText());
        assertEquals("950300", content.path("hsCode").asText());
        assertEquals("DK", content.path("country").asText());
    }

    @Test
    void omitsCustomsFieldsForDomesticLatvianShipment() throws Exception {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {"packageId": 12345, "addressBarcodes": [], "documents": [{"link": "/download/label.pdf"}]}
                """);
        transport.respond(HttpStatus.OK, MediaType.APPLICATION_PDF, "%PDF");

        client(transport).createSmallPackageLabel(Order.builder()
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(Tariff.Mode.SIMPLE)
                .fullName("Test Recipient")
                .country("LV")
                .address1("Testa iela 1")
                .address2("Riga")
                .postcode("LV-1001")
                .weight(new BigDecimal("100"))
                .quantity(1)
                .packValue(new BigDecimal("1.00"))
                .build());

        var packageCreate = packageCreate(transport.requests.get(0).body());
        assertTrue(packageCreate.path("apiz").asBoolean());
        var address = packageCreate.path("addresses").get(0);
        assertTrue(address.path("contentType").isMissingNode());
        assertTrue(address.path("contentItems").isMissingNode());
        assertTrue(address.path("commercial").isMissingNode());
    }

    @Test
    void usesTrackedPostageForTraceableMode() throws Exception {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {"packageId": 12345, "addressBarcodes": [], "documents": [{"link": "/download/label.pdf"}]}
                """);
        transport.respond(HttpStatus.OK, MediaType.APPLICATION_PDF, "%PDF");

        client(transport).createSmallPackageLabel(order(Tariff.Mode.TRACEABLE));

        var packageCreate = packageCreate(transport.requests.get(0).body());
        assertEquals("Tracked", packageCreate.path("postageType").asText());
    }

    @Test
    void requestsAddressLabelDocumentWhenPackageResponseHasNoLink() throws Exception {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {"packageId": 12345, "addressBarcodes": ["RR123456789LV"], "documents": []}
                """);
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {"code": 201, "message": "created", "link": "/api/download/generated.pdf"}
                """);
        transport.respond(HttpStatus.OK, MediaType.APPLICATION_PDF, "%PDF generated");

        var result = client(transport).createSmallPackageLabel(order(Tariff.Mode.SIMPLE));

        assertArrayEquals("%PDF generated".getBytes(StandardCharsets.UTF_8), result.pdf());
        assertEquals(3, transport.requests.size());
        assertEquals(URI.create("https://api.test/api/documents"), transport.requests.get(1).uri());
        assertEquals(URI.create("https://api.test/api/download/generated.pdf"), transport.requests.get(2).uri());

        var document = MAPPER.readTree(transport.requests.get(1).body()).path("document");
        assertEquals("api-user", document.path("user").asText());
        assertEquals("api-key", document.path("api_key").asText());
        assertEquals("12345", document.path("package").asText());
        assertEquals("Address labels", document.path("documentType").asText());
        assertEquals("A4", document.path("documentPrintType").asText());
    }

    @Test
    void mapsMansPastsValidationErrorsToApiException() {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.UNPROCESSABLE_ENTITY, MediaType.APPLICATION_JSON, """
                {"code": 422, "message": "Root element OK, invalid data"}
                """);

        var ex = assertThrows(LatvijasPastsApiException.class, () -> client(transport).createSmallPackageLabel(order(Tariff.Mode.SIMPLE)));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.getStatusCode());
        assertTrue(ex.getMessage().contains("invalid data"));
    }

    @Test
    void requiresConfiguredApiCredentials() {
        var client = new LatvijasPastsApiClient(" ", " ", "https://api.test", new RestTemplate());

        var ex = assertThrows(LatvijasPastsApiException.class, () -> client.createSmallPackageLabel(order(Tariff.Mode.SIMPLE)));

        assertEquals("Mans Pasts API credentials are not configured", ex.getMessage());
    }

    @Test
    void trimsApiCredentials() throws Exception {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.CREATED, MediaType.APPLICATION_JSON, """
                {"packageId": 12345, "addressBarcodes": [], "documents": [{"link": "/download/label.pdf"}]}
                """);
        transport.respond(HttpStatus.OK, MediaType.APPLICATION_PDF, "%PDF");

        var restTemplate = new RestTemplate();
        restTemplate.getInterceptors().add(transport);
        new LatvijasPastsApiClient(" api-user ", " api-key ", "https://api.test", restTemplate)
                .createSmallPackageLabel(order(Tariff.Mode.SIMPLE));

        var packageCreate = packageCreate(transport.requests.get(0).body());
        assertEquals("api-user", packageCreate.path("user").asText());
        assertEquals("api-key", packageCreate.path("api_key").asText());
    }

    @Test
    void apiErrorsIncludeSanitizedRejectedRequest() {
        var transport = new RecordingTransport();
        transport.respond(HttpStatus.UNPROCESSABLE_ENTITY, MediaType.APPLICATION_JSON, """
                {"code":422,"message":"api.invalid_data"}
                """);

        var ex = assertThrows(LatvijasPastsApiException.class, () -> client(transport).createSmallPackageLabel(order(Tariff.Mode.SIMPLE)));

        assertTrue(ex.getMessage().contains("\"api_key\":\"***\""));
        assertTrue(ex.getMessage().contains("\"type\":\"goods\""));
        assertTrue(ex.getMessage().contains("\"itemType\":\"Parcel\""));
        assertTrue(!ex.getMessage().contains("api-key"));
    }

    private static LatvijasPastsApiClient client(RecordingTransport transport) {
        var restTemplate = new RestTemplate();
        restTemplate.getInterceptors().add(transport);
        return new LatvijasPastsApiClient("api-user", "api-key", "https://api.test", restTemplate);
    }

    private static JsonNode packageCreate(String body) throws Exception {
        return MAPPER.readTree(body).path("package_create");
    }

    private static Order order(Tariff.Mode mode) {
        return Order.builder()
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(mode)
                .fullName("Jane Buyer")
                .email("jane@example.com")
                .telephone("+15551234567")
                .country("US")
                .state("CA")
                .address1("Main street 1, Apt 2")
                .address2("CA, Los Angeles")
                .postcode("90001")
                .weight(new BigDecimal("350"))
                .quantity(12)
                .packValue(new BigDecimal("49.95"))
                .build();
    }

    private record RecordedRequest(URI uri, HttpMethod method, HttpHeaders headers, String body) {
    }

    private record PlannedResponse(HttpStatusCode statusCode, MediaType contentType, byte[] body) {
    }

    private static class RecordingTransport implements ClientHttpRequestInterceptor {
        private final List<RecordedRequest> requests = new ArrayList<>();
        private final ArrayDeque<PlannedResponse> responses = new ArrayDeque<>();

        private void respond(HttpStatusCode status, MediaType contentType, String body) {
            responses.add(new PlannedResponse(status, contentType, body.getBytes(StandardCharsets.UTF_8)));
        }

        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution) {
            assertInstanceOf(HttpMethod.class, request.getMethod());
            requests.add(new RecordedRequest(
                    request.getURI(),
                    request.getMethod(),
                    request.getHeaders(),
                    new String(body, StandardCharsets.UTF_8)
            ));
            if (responses.isEmpty()) {
                throw new AssertionError("No planned response for " + request.getMethod() + " " + request.getURI());
            }
            return new StaticClientHttpResponse(responses.removeFirst());
        }
    }

    private static class StaticClientHttpResponse implements ClientHttpResponse {
        private final PlannedResponse response;
        private final HttpHeaders headers = new HttpHeaders();

        private StaticClientHttpResponse(PlannedResponse response) {
            this.response = response;
            headers.setContentType(response.contentType());
        }

        @Override
        public HttpStatusCode getStatusCode() {
            return response.statusCode();
        }

        @Override
        public String getStatusText() {
            return response.statusCode().toString();
        }

        @Override
        public void close() {
        }

        @Override
        public InputStream getBody() throws IOException {
            return new ByteArrayInputStream(response.body());
        }

        @Override
        public HttpHeaders getHeaders() {
            return headers;
        }
    }
}
