package com.vastbricks.api.ledger.bank;

import com.vastbricks.api.ledger.bank.BankStatementPayload.EntriesResponse;
import com.vastbricks.api.ledger.bank.BankStatementPayload.EntryResponse;
import com.vastbricks.api.ledger.bank.BankStatementPayload.ImportResponse;
import com.vastbricks.api.ledger.bank.BankStatementPayload.MappingRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Importing a bank statement, and reading back what it left.
 *
 * <p>The bank is the one party to an order Vast cannot read live, so unlike the rest of reconciliation this is
 * stored — and therefore re-imported. An import upserts by the bank's own entry reference, so the same document may
 * be uploaded as often as it is exported without duplicating anything.
 */
@RestController
@RequestMapping(path = "/api/private/bank-statements", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Slf4j
class BankStatementController {

    private final BankStatementService statements;

    /**
     * Imports a camt.052 or camt.053 document sent as the request body.
     *
     * <p>The document is the body rather than a multipart part on purpose: a multipart upload would need Spring's
     * default one-megabyte part cap raised in both launchers' configuration, and a busy month's statement passes it.
     * A raw body has no such cap, and the portal has a file's text in hand anyway.
     */
    @PostMapping(consumes = {MediaType.APPLICATION_XML_VALUE, MediaType.TEXT_XML_VALUE})
    ImportResponse importStatement(@RequestBody String document) {
        return statements.importDocument(document);
    }

    /**
     * The entries of one period, and what they came to. The period is a month while mappings are being written
     * against entries, and a year while a year is being looked over, so one parameter carries both forms.
     */
    @GetMapping("/entries")
    EntriesResponse entries(@RequestParam("period") String period) {
        return statements.entriesOf(periodOf(period));
    }

    @PutMapping(path = "/entries/{id}/mapping", consumes = MediaType.APPLICATION_JSON_VALUE)
    EntryResponse updateMapping(@PathVariable("id") Long id, @RequestBody MappingRequest request) {
        return statements.updateMapping(id, request.getMapping())
                // Another tenant's entry is not found rather than refused: @TenantId puts the tenant in the SQL of
                // the load, so there is nothing here to distinguish "not yours" from "not there".
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No such bank statement entry"));
    }

    private static BankStatementPeriod periodOf(String period) {
        try {
            return BankStatementPeriod.of(period);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage(), e);
        }
    }

    @ExceptionHandler(BankStatementImportException.class)
    ProblemDetail handleUnreadableDocument(BankStatementImportException exception) {
        log.warn("Bank statement import rejected: {}", exception.getMessage());
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Bank statement import failed");
        return problem;
    }
}
