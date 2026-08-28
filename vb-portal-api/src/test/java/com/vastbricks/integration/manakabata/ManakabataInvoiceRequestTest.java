package com.vastbricks.integration.manakabata;

import com.vastbricks.integration.manakabata.client.ApiClient;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManakabataInvoiceRequestTest {

    @Test
    void serializesSelectorReferencesAsObjects() throws Exception {
        var request = ManakabataInvoiceRequest.builder()
            .invoiceCategory("product")
            .invoiceType("bill_of_landing")
            .recipientSelectionMode("existing")
            .recipient(new ManakabataUuidReference("client-uuid"))
            .payerIsRecipient(true)
            .invoicedAt(LocalDate.of(2026, 8, 25))
            .invoiceLocale("en")
            .currency("EUR")
            .showCode(true)
            .showDiscount(true)
            .publicLink(true)
            .invoiceNumeratorSelectionMode("existing")
            .invoiceNumerator(new ManakabataUuidReference("numerator-uuid"))
            .teamBankAccountSelectionMode("existing")
            .teamBankAccount(new ManakabataUuidReference("bank-account-uuid"))
            .build();

        var json = new ApiClient().getObjectMapper().valueToTree(request);

        assertEquals("client-uuid", json.path("recipient").path("uuid").asText());
        assertEquals("numerator-uuid", json.path("invoice_numerator").path("uuid").asText());
        assertEquals("bank-account-uuid", json.path("team_bank_account").path("uuid").asText());
        assertEquals("2026-08-25", json.path("invoiced_at").asText());
        assertTrue(json.path("is_public_link").asBoolean());
        assertFalse(json.has("public_link"));
        assertEquals(15, json.size());
    }
}
