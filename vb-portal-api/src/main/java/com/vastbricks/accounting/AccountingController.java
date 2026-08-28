package com.vastbricks.accounting;

import com.vastbricks.accounting.paypal.PayPalTransactionService;
import com.vastbricks.accounting.stripe.StripeTransactionService;
import com.vastbricks.integration.manakabata.ManakabataApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@RestController
@RequiredArgsConstructor
@Slf4j
public class AccountingController {
    private final AccountingService accountingService;
    private final PayPalTransactionService payPalTransactionService;
    private final StripeTransactionService stripeTransactionService;
    private final AccountingPaymentMatcher accountingPaymentMatcher;
    private final ManakabataInvoiceService manakabataInvoiceService;

    @GetMapping("/api/private/accounting")
    public AccountingPage accountingApi(
            @RequestParam(value = "month", required = false) String requestedMonth
    ) {
        return loadAccounting(requestedMonth);
    }

    @PostMapping("/api/private/accounting/invoices")
    public GenerateInvoiceResult generateInvoice(@RequestBody GenerateInvoiceRequest request) {
        return manakabataInvoiceService.generateInvoice(request.getOrderId(), request.getSource());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ProblemDetail invoiceGenerationError(IllegalArgumentException ex) {
        log.warn("Invoice generation rejected: {}", ex.getMessage());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Invoice generation failed");
        return problem;
    }

    @ExceptionHandler(ManakabataApiException.class)
    ProblemDetail manakabataError(ManakabataApiException ex) {
        log.error("Manakabata invoice generation failed: {}", ex.getMessage());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_GATEWAY, ex.getMessage());
        problem.setTitle("Manakabata request failed");
        return problem;
    }

    AccountingPage loadAccounting(String requestedMonth) {
        var month = parseMonth(requestedMonth);
        var orders = accountingService.findOrders(month);
        accountingPaymentMatcher.matchPayPal(orders, payPalTransactionService.findTransactions(month));
        accountingPaymentMatcher.matchStripe(orders, stripeTransactionService.findTransactions(month));
        return new AccountingPage(month.toString(), orders, AccountingSummary.from(orders));
    }

    YearMonth parseMonth(String value) {
        if (value == null || value.isBlank()) {
            return YearMonth.now().minusMonths(1);
        }
        try {
            return YearMonth.parse(value);
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "month must use YYYY-MM format", ex);
        }
    }
}
