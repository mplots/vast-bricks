package com.vastbricks.api.bankstatement;

import static java.math.BigDecimal.ZERO;

import com.vastbricks.api.bankstatement.BankStatementPayload.AccountImportResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.CurrencySummaryResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.EntriesResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.EntryResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.ImportResponse;
import com.vastbricks.api.reconciliation.ReconciliationAmount;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Holds a tenant's imported bank entries, and is the only writer of them.
 *
 * <p>Nothing here names a tenant. Every query and write goes through the repository, whose entity carries
 * {@code @TenantId}, so the serving tenant is in the generated SQL whether the row is being found by account and
 * reference or loaded by its primary key.
 */
@Service
@RequiredArgsConstructor
class BankStatementService {

    private final BankStatementReader reader;
    private final BankStatementEntryRepository entries;

    /**
     * Imports a camt.052 or camt.053 document, inserting entries this tenant has not seen and refreshing the ones it
     * has. Re-importing an overlapping range is the expected way to use this, not an accident to be guarded against.
     */
    @Transactional
    ImportResponse importDocument(String document) {
        var imported = reader.read(document);
        var counts = new LinkedHashMap<String, int[]>();

        for (var values : imported) {
            var account = counts.computeIfAbsent(values.getAccountIban(), iban -> new int[3]);
            account[0]++;

            var existing = entries.findByAccountIbanAndEntryReference(values.getAccountIban(), values.getEntryReference());
            var entry = existing.orElseGet(() -> new BankStatementEntry(values.getAccountIban(), values.getEntryReference()));
            apply(values, entry);
            entries.save(entry);

            if (existing.isPresent()) {
                account[2]++;
            } else {
                account[1]++;
            }
        }

        var accounts = new ArrayList<AccountImportResponse>(counts.size());
        var read = 0;
        var created = 0;
        var updated = 0;
        for (var account : counts.entrySet()) {
            var count = account.getValue();
            accounts.add(new AccountImportResponse(account.getKey(), count[0], count[1], count[2]));
            read += count[0];
            created += count[1];
            updated += count[2];
        }
        return new ImportResponse(accounts, read, created, updated);
    }

    /**
     * The period's entries by booking date, which is the day the account actually moved, and what they came to.
     *
     * <p>The summary rides with the entries rather than in an endpoint of its own, for the reason the reconciliation
     * field roster does: a screen can then never show a period's entries under a summary fetched for another one.
     */
    @Transactional(readOnly = true)
    EntriesResponse entriesOf(BankStatementPeriod period) {
        var found = entries.findByBookingDateBetweenOrderByBookingDateAscIdAsc(period.getFrom(), period.getTo());
        return new EntriesResponse(found.stream().map(BankStatementService::toResponse).toList(), summaryOf(found, period));
    }

    /**
     * What the period came to, per currency: the two turnovers from the period's own entries, and the balance from
     * every entry stored up to the end of it.
     *
     * <p>Only the currencies the period actually moved in get a row. A currency the account holds but did not move
     * this period has a balance and no turnovers, and stating it under a period it took no part in would read as a
     * movement that did not happen.
     */
    private List<CurrencySummaryResponse> summaryOf(List<BankStatementEntry> found, BankStatementPeriod period) {
        var turnovers = new LinkedHashMap<String, BigDecimal[]>();
        for (var entry : found) {
            var currency = turnovers.computeIfAbsent(entry.getCurrency(), ignored -> new BigDecimal[]{ZERO, ZERO});
            var slot = entry.getDirection() == BankStatementDirection.DEBIT ? 0 : 1;
            currency[slot] = currency[slot].add(entry.getAmount());
        }

        var balances = new HashMap<String, BigDecimal>();
        for (var total : entries.totalsUpTo(period.getTo())) {
            // Credits less debits: the amounts are stored unsigned, so the direction is what puts the sign back.
            var signed = total.getDirection() == BankStatementDirection.DEBIT ? total.getTotal().negate() : total.getTotal();
            balances.merge(total.getCurrency(), signed, BigDecimal::add);
        }

        return turnovers.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(currency -> new CurrencySummaryResponse(
                        currency.getKey(),
                        ReconciliationAmount.normalize(currency.getValue()[0]),
                        ReconciliationAmount.normalize(currency.getValue()[1]),
                        // What the period itself moved by, which its own two turnovers come to.
                        ReconciliationAmount.normalize(currency.getValue()[1].subtract(currency.getValue()[0])),
                        ReconciliationAmount.normalize(balances.getOrDefault(currency.getKey(), ZERO))
                ))
                .toList();
    }

    /**
     * Writes the mapping a person entered against an entry. Empty is erasing it rather than storing a blank, and an
     * id belonging to another tenant is simply not found, because {@code @TenantId} is in the SQL of the load.
     */
    @Transactional
    Optional<EntryResponse> updateMapping(Long id, String mapping) {
        return entries.findById(id).map(entry -> {
            var trimmed = mapping == null ? null : mapping.trim();
            entry.setMapping(trimmed == null || trimmed.isEmpty() ? null : trimmed);
            return toResponse(entries.save(entry));
        });
    }

    /** Every field the document stated, and deliberately not {@code mapping}: that one belongs to whoever wrote it. */
    private static void apply(ImportedBankStatementEntry values, BankStatementEntry entry) {
        entry.setBookingDate(values.getBookingDate());
        entry.setValueDate(values.getValueDate());
        entry.setAmount(values.getAmount());
        entry.setCurrency(values.getCurrency());
        entry.setDirection(values.getDirection());
        entry.setStatus(values.getStatus());
        entry.setDomainCode(values.getDomainCode());
        entry.setFamilyCode(values.getFamilyCode());
        entry.setSubFamilyCode(values.getSubFamilyCode());
        entry.setProprietaryCode(values.getProprietaryCode());
        entry.setCounterpartyName(values.getCounterpartyName());
        entry.setCounterpartyIban(values.getCounterpartyIban());
        entry.setCounterpartyBic(values.getCounterpartyBic());
        entry.setEndToEndId(values.getEndToEndId());
        entry.setInstructionId(values.getInstructionId());
        entry.setRemittanceInformation(values.getRemittanceInformation());
    }

    private static EntryResponse toResponse(BankStatementEntry entry) {
        return EntryResponse.builder()
                .id(entry.getId())
                .accountIban(entry.getAccountIban())
                .entryReference(entry.getEntryReference())
                .bookingDate(entry.getBookingDate())
                .valueDate(entry.getValueDate())
                .amount(entry.getAmount())
                .currency(entry.getCurrency())
                .direction(entry.getDirection())
                .status(entry.getStatus())
                .domainCode(entry.getDomainCode())
                .familyCode(entry.getFamilyCode())
                .subFamilyCode(entry.getSubFamilyCode())
                .proprietaryCode(entry.getProprietaryCode())
                .counterpartyName(entry.getCounterpartyName())
                .counterpartyIban(entry.getCounterpartyIban())
                .counterpartyBic(entry.getCounterpartyBic())
                .endToEndId(entry.getEndToEndId())
                .instructionId(entry.getInstructionId())
                .remittanceInformation(entry.getRemittanceInformation())
                .mapping(entry.getMapping())
                .build();
    }
}
