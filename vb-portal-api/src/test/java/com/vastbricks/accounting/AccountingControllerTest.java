package com.vastbricks.accounting;

import com.vastbricks.integration.manakabata.ManakabataApiException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;

import java.time.YearMonth;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AccountingControllerTest {
    private final AccountingController controller = new AccountingController(null, null, null, null, null);

    @Test
    void defaultsToPreviousMonth() {
        assertEquals(YearMonth.now().minusMonths(1), controller.parseMonth(null));
        assertEquals(YearMonth.now().minusMonths(1), controller.parseMonth(" "));
    }

    @Test
    void parsesSelectedMonth() {
        assertEquals(YearMonth.of(2026, 8), controller.parseMonth("2026-08"));
    }

    @Test
    void exposesInvoiceValidationMessage() {
        var problem = controller.invoiceGenerationError(new IllegalArgumentException("Brick Owl order has no order date"));

        assertEquals(400, problem.getStatus());
        assertEquals("Invoice generation failed", problem.getTitle());
        assertEquals("Brick Owl order has no order date", problem.getDetail());
    }

    @Test
    void exposesManakabataValidationResponse() {
        var cause = HttpClientErrorException.create(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "Unprocessable Entity",
            HttpHeaders.EMPTY,
            "{\"message\":\"Invalid invoice\"}".getBytes(),
            null
        );

        var problem = controller.manakabataError(new ManakabataApiException(cause));

        assertEquals(502, problem.getStatus());
        assertEquals("Manakabata request failed", problem.getTitle());
        assertEquals("Manakabata returned HTTP 422: {\"message\":\"Invalid invoice\"}", problem.getDetail());
    }
}
