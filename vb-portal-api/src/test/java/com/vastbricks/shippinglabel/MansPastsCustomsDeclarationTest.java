package com.vastbricks.shippinglabel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vastbricks.market.owl.OrderView;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MansPastsCustomsDeclarationTest {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Test
    void includesCustomsDeclarationForNonEuShipment() {
        var payload = MAPPER.valueToTree(MansPastsShippingApiClient.PackageCreateRequest.from(
                "USER",
                "KEY",
                request("GB")
        ));

        var address = payload.path("addresses").get(0);
        assertEquals("Other", address.path("contentType").asText());
        assertEquals("LV40203724029", address.path("customsIndication").asText());
        assertEquals("IMPORTER-TAX-ID", address.path("importerDetails").asText());
        assertEquals("invoice", address.path("relatedDocuments").asText());
        assertEquals("BrickLink Invoice", address.path("docDescription").asText());
        assertEquals("INV-1", address.path("docNumber").asText());
        assertFalse(address.has("userPackageWeight"));
        assertEquals(0, new BigDecimal("7.50").compareTo(address.path("postage_paid").decimalValue()));

        var items = address.path("contentItems");
        assertEquals(1, items.size());
        var item = items.get(0);
        assertEquals("Lego Set", item.path("name").asText());
        assertEquals(1, item.path("quantity").asInt());
        assertEquals(0, new BigDecimal("500").compareTo(item.path("weight").decimalValue()));
        assertEquals(0, new BigDecimal("25.00").compareTo(item.path("value").decimalValue()));
        assertEquals("950300", item.path("hsCode").asText());
        assertEquals("DK", item.path("country").asText());
    }

    @Test
    void omitsCustomsDeclarationForEuShipment() {
        var payload = MAPPER.valueToTree(MansPastsShippingApiClient.PackageCreateRequest.from(
                "USER",
                "KEY",
                request("de")
        ));

        var address = payload.path("addresses").get(0);
        assertFalse(address.has("contentType"));
        assertFalse(address.has("customsIndication"));
        assertFalse(address.has("importerDetails"));
        assertFalse(address.has("relatedDocuments"));
        assertFalse(address.has("docDescription"));
        assertFalse(address.has("docNumber"));
        assertFalse(address.has("postage_paid"));
        assertFalse(address.has("contentItems"));
        assertEquals(0, new BigDecimal("0.5").compareTo(address.path("userPackageWeight").decimalValue()));
        assertTrue(MansPastsShippingApiClient.isEuCountry(" lv "));
        assertFalse(MansPastsShippingApiClient.isEuCountry("GB"));
        assertEquals("GB", MansPastsShippingApiClient.normalizeCountryCode("UK"));
    }

    @Test
    void omitsPackageWeightAndConvertsContentWeightToGramsForNonEuShipment() {
        var payload = MAPPER.valueToTree(MansPastsShippingApiClient.PackageCreateRequest.from(
                "USER",
                "KEY",
                request("UK", new BigDecimal("0.1"))
        ));

        var address = payload.path("addresses").get(0);
        assertEquals("GB", address.path("countryCode").asText());
        assertFalse(address.has("userPackageWeight"));
        assertEquals(0, new BigDecimal("100").compareTo(
                address.path("contentItems").get(0).path("weight").decimalValue()
        ));
    }

    @Test
    void logsWholeGramWeightsWithoutScientificNotation() {
        var json = MansPastsShippingApiClient.sanitized(Map.of(
                "package_create", Map.of(
                        "api_key", "secret",
                        "userPackageWeight", new BigDecimal("100")
                )
        ));

        assertTrue(json.contains("\"userPackageWeight\":100"));
        assertTrue(json.contains("\"api_key\":\"***\""));
        assertFalse(json.contains("1E+2"));
        assertFalse(json.contains("secret"));
    }

    @Test
    void mapsMarketplaceAmountsUsedByCustomsDeclaration() throws Exception {
        assertEquals(
                new BigDecimal("27.25"),
                BricklinkShippingRequestService.amountWithAdditional(
                        new BigDecimal("25.00"),
                        new BigDecimal("2.25")
                )
        );
        assertEquals(
                new BigDecimal("7.50"),
                BricklinkShippingRequestService.amountWithAdditional(
                        new BigDecimal("6.50"),
                        new BigDecimal("1.00")
                )
        );

        var brickOwlOrder = MAPPER.readValue("""
                {"sub_total": 25.00, "shipping": 7.50}
                """, OrderView.class);
        assertEquals(new BigDecimal("25.00"), brickOwlOrder.getSubTotal());
        assertEquals(new BigDecimal("7.50"), brickOwlOrder.getShipping());
    }

    private MansPastsPackageRequest request(String countryCode) {
        return request(countryCode, new BigDecimal("0.5"));
    }

    private MansPastsPackageRequest request(String countryCode, BigDecimal weight) {
        return new MansPastsPackageRequest(
                "Goods",
                "Registered",
                "Parcel",
                countryCode,
                "Recipient name",
                "Street 1, London",
                "SW1A 1AA",
                "Recipient name",
                null,
                null,
                weight,
                new BigDecimal("25.00"),
                new BigDecimal("7.50"),
                "IMPORTER-TAX-ID",
                "invoice",
                "BrickLink Invoice",
                "INV-1",
                null
        );
    }
}
