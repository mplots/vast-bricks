package com.vastbricks.api.stripeledger;

import com.vastbricks.api.ledger.LedgerPeriod;
import com.vastbricks.api.stripeledger.StripeLedgerPayload.TransactionsResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Reading the Stripe balance ledger a period at a time.
 *
 * <p>Nothing is imported and nothing is stored: Stripe holds the account and answers for it, so the period is
 * fetched when the screen asks for it. That is why this reads like the bank statement screen and is built like
 * reconciliation.
 *
 * <p>The feature is named for the ledger it reads rather than for the screen that reads it, which is the Stripe
 * transaction screen and asks for {@code /api/private/stripe-transactions}. {@code vb-portal-api} still holds the
 * legacy accounting screen's own {@code StripeTransactionService}, and one launcher scans both, so a
 * {@code StripeTransaction} of ours would have collided with it on the bean name — and would go on colliding as
 * either side grew a class the other already had. The ledger is what this actually reads, so the name is not a
 * workaround it has to shed when the legacy screen is retired.
 */
@RestController
@RequestMapping(path = "/api/private/stripe-transactions", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class StripeLedgerController {

    private final StripeLedgerService transactions;

    /**
     * The balance transactions of one period, and what they came to. The period is a month while a month is being
     * looked over and a year while a year is, so one parameter carries both forms.
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
