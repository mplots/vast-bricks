package com.vastbricks.shipping;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Disabled("Creates a real Mans Pasts package")
class LatvijasPastsApiClientLiveTest {

    @Test
    void createsRealSmallPackageLabel() {
        var apiUser = System.getenv("TEST_MANS_PASTS_API_USER");
        var apiKey = System.getenv("TEST_MANS_PASTS_API_KEY");
        var baseUrl = System.getenv().getOrDefault("TEST_MANS_PASTS_API_BASE_URL", "https://www.manspasts.lv");

        assertNotNull(apiUser, "TEST_MANS_PASTS_API_USER is required");
        assertNotNull(apiKey, "TEST_MANS_PASTS_API_KEY is required");

        var client = new LatvijasPastsApiClient(apiUser, apiKey, baseUrl, LatvijasPastsApiClient.createRestTemplate());
        var country = System.getenv().getOrDefault("TEST_MANS_PASTS_RECIPIENT_COUNTRY", "AU");
        var orderBuilder = Order.builder()
                .type(Tariff.Type.SMALL_PACKAGE)
                .mode(Tariff.Mode.SIMPLE)
                .fullName(System.getenv().getOrDefault("TEST_MANS_PASTS_RECIPIENT_NAME", "Test Recipient"))
                .country(country)
                .address1(System.getenv().getOrDefault("TEST_MANS_PASTS_RECIPIENT_ADDRESS1", defaultAddress1(country)))
                .address2(System.getenv().getOrDefault("TEST_MANS_PASTS_RECIPIENT_ADDRESS2", defaultAddress2(country)))
                .postcode(System.getenv().getOrDefault("TEST_MANS_PASTS_RECIPIENT_POSTCODE", defaultPostcode(country)))
                .weight(new BigDecimal(System.getenv().getOrDefault("TEST_MANS_PASTS_WEIGHT", "100")))
                .quantity(Integer.valueOf(System.getenv().getOrDefault("TEST_MANS_PASTS_QUANTITY", "1")))
                .packValue(new BigDecimal(System.getenv().getOrDefault("TEST_MANS_PASTS_PACK_VALUE", "1.00")));
        if (System.getenv("TEST_MANS_PASTS_RECIPIENT_EMAIL") != null) {
            orderBuilder.email(System.getenv("TEST_MANS_PASTS_RECIPIENT_EMAIL"));
        }
        if (System.getenv("TEST_MANS_PASTS_RECIPIENT_PHONE") != null) {
            orderBuilder.telephone(System.getenv("TEST_MANS_PASTS_RECIPIENT_PHONE"));
        }

        var result = client.createSmallPackageLabel(orderBuilder.build());

        assertNotNull(result.packageId());
        assertNotNull(result.pdf());
        assertTrue(result.pdf().length > 4);
        assertTrue(new String(result.pdf(), 0, 4, StandardCharsets.UTF_8).equals("%PDF"));
    }

    private static String defaultAddress1(String country) {
        return "LV".equalsIgnoreCase(country) ? "Testa iela 1" : "1 George Street";
    }

    private static String defaultAddress2(String country) {
        return "LV".equalsIgnoreCase(country) ? "Riga" : "Sydney NSW";
    }

    private static String defaultPostcode(String country) {
        return "LV".equalsIgnoreCase(country) ? "LV-1001" : "2000";
    }
}
