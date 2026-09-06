package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickstore.BrickStoreClientException;
import com.vastbricks.api.client.manakabata.ManakabataClientException;
import com.vastbricks.api.client.paypal.PayPalClientException;
import com.vastbricks.api.client.stripe.StripeClientException;
import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationFieldDescriptor;
import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationOrdersResponse;
import java.util.Arrays;
import java.time.YearMonth;
import java.util.List;
import java.time.format.DateTimeParseException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
class ReconciliationController {

    private final ReconciliationService reconciliationService;

    @GetMapping("/orders")
    ReconciliationOrdersResponse listOrders(@RequestParam("month") String month) {
        var selectedMonth = parseMonth(month);
        return new ReconciliationOrdersResponse(
                selectedMonth.toString(),
                fieldRoster(),
                reconciliationService.findOrders(selectedMonth)
        );
    }

    /** The field roster, which is the same for every month: the declared fields, in the order they are declared. */
    private List<ReconciliationFieldDescriptor> fieldRoster() {
        return Arrays.stream(ReconciliationOrderField.values())
                .map(ReconciliationFieldDescriptor::of)
                .toList();
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
        // What went wrong was logged with its stack where the source failed; this says which failure the request
        // answered with, since several providers may have failed for one request.
        log.error("Reconciliation failed: {}", exception.getMessage());
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
