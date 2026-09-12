package com.vastbricks.api.reconciliation;

import com.vastbricks.api.client.brickowl.BrickOwlClientException;
import com.vastbricks.api.client.brickstore.BrickStoreClientException;
import com.vastbricks.api.client.manakabata.ManakabataClientException;
import com.vastbricks.api.client.manspasts.MansPastsClientException;
import com.vastbricks.api.client.paypal.PayPalClientException;
import com.vastbricks.api.client.stripe.StripeClientException;
import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationFieldDescriptor;
import com.vastbricks.api.reconciliation.ReconciliationPayload.ReconciliationOrdersResponse;
import java.util.Arrays;
import java.time.YearMonth;
import java.time.LocalDate;
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
    ReconciliationOrdersResponse listOrders(
            @RequestParam(value = "month", required = false) String month,
            @RequestParam(value = "from", required = false) String from,
            @RequestParam(value = "to", required = false) String to
    ) {
        var period = parsePeriod(month, from, to);
        return new ReconciliationOrdersResponse(
                month,
                period.getFrom().toString(),
                period.getTo().toString(),
                fieldRoster(),
                reconciliationService.findOrders(period)
        );
    }

    /** Keep existing month links working while explicit ranges become the report's input. */
    private ReconciliationPeriod parsePeriod(String month, String from, String to) {
        if (month != null) {
            if (from != null || to != null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Use either month or from and to");
            }
            var selectedMonth = parseMonth(month);
            return new ReconciliationPeriod(selectedMonth.atDay(1), selectedMonth.atEndOfMonth());
        }
        if (from == null || to == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Both from and to are required");
        }
        try {
            if (!from.matches("\\d{4}-\\d{2}-\\d{2}") || !to.matches("\\d{4}-\\d{2}-\\d{2}")) {
                throw new IllegalArgumentException("from and to must use YYYY-MM-DD format");
            }
            return new ReconciliationPeriod(LocalDate.parse(from), LocalDate.parse(to));
        } catch (DateTimeParseException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "from and to must be valid YYYY-MM-DD dates");
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, exception.getMessage());
        }
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
            MansPastsClientException.class,
            PayPalClientException.class,
            StripeClientException.class
    })
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    String handleProviderException(RuntimeException exception) {
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
