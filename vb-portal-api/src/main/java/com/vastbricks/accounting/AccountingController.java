package com.vastbricks.accounting;

import com.vastbricks.accounting.paypal.PayPalTransactionService;
import com.vastbricks.accounting.stripe.StripeTransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

@RestController
@RequiredArgsConstructor
public class AccountingController {
    private final AccountingService accountingService;
    private final PayPalTransactionService payPalTransactionService;
    private final StripeTransactionService stripeTransactionService;
    private final AccountingPaymentMatcher accountingPaymentMatcher;

    @GetMapping("/api/private/accounting")
    public AccountingPage accountingApi(
            @RequestParam(value = "month", required = false) String requestedMonth
    ) {
        return loadAccounting(requestedMonth);
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
