package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickstore.BrickStoreClientException;
import com.vastbricks.api.client.manakabata.ManakabataClientException;
import com.vastbricks.api.client.paypal.PayPalClientException;
import com.vastbricks.api.client.stripe.StripeClientException;
import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationOrdersResponse;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping(value = "/api/private/reconciliation", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class ReconciliationController {

    private final ReconciliationService reconciliationService;

    @GetMapping("/orders")
    ReconciliationOrdersResponse listOrders(@RequestParam("month") String month) {
        var selectedMonth = parseMonth(month);
        return new ReconciliationOrdersResponse(
                selectedMonth.toString(),
                reconciliationService.findOrders(selectedMonth)
        );
    }

    @ExceptionHandler({
            BrickStoreClientException.class,
            BrickOwlClientException.class,
            ManakabataClientException.class,
            PayPalClientException.class,
            StripeClientException.class
    })
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    String handleDataSourceException(RuntimeException exception) {
        return exception.getMessage();
    }

    private YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must use YYYY-MM format");
        }
    }
}
