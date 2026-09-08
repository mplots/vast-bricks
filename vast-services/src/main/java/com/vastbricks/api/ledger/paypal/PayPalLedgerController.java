package com.vastbricks.api.ledger.paypal;

import com.vastbricks.api.ledger.LedgerPeriod;
import com.vastbricks.api.ledger.paypal.PayPalLedgerPayload.TransactionsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reading the PayPal account's ledger a period at a time.
 *
 * <p>Nothing is imported and nothing is stored: PayPal holds the account and answers for it, so the period is fetched
 * when the screen asks for it. That is why this reads like the bank statement screen and is built like the Stripe
 * transaction screen beside it.
 *
 * <p>The feature is named for the ledger it reads rather than for the screen that reads it, which is the PayPal
 * transaction screen and asks for {@code /api/private/paypal-transactions}. {@code vb-portal-api} already holds the
 * legacy accounting screen's own {@code PayPalTransaction} and {@code PayPalTransactionService}, and one launcher
 * scans both, so a {@code PayPalTransaction} of ours would have collided with it on the bean name.
 */
@RestController
@RequestMapping(path = "/api/private/paypal-transactions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class PayPalLedgerController {

    private final PayPalLedgerService transactions;

    /**
     * The transactions of one period, and what they came to. The period is a month while a month is being looked over
     * and a year while a year is, so one parameter carries both forms.
     */
    @GetMapping
    TransactionsResponse transactions(@RequestParam("period") String period) {
        return transactions.transactionsOf(periodOf(period));
    }

    private static LedgerPeriod periodOf(String period) {
        try {
            return LedgerPeriod.of(period);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }
}
