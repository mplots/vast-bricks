package com.vastbricks.api.bankstatement;

import com.vastbricks.api.bankstatement.BankStatementPayload.AccountImportResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.EntryResponse;
import com.vastbricks.api.bankstatement.BankStatementPayload.ImportResponse;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
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

    /** The month's entries by booking date, which is the day the account actually moved. */
    @Transactional(readOnly = true)
    List<EntryResponse> entriesOf(YearMonth month) {
        return entries
                .findByBookingDateBetweenOrderByBookingDateAscIdAsc(month.atDay(1), month.atEndOfMonth())
                .stream()
                .map(BankStatementService::toResponse)
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
