package com.vastbricks.api.bankstatement;

import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * This feature's public API: the booked entries of a span of days, for a feature that reconciles against the bank.
 *
 * <p>It is deliberately the whole of what leaves the package. Importing, upserting, the summary a screen reads and
 * the mapping a person writes are internals; what another feature needs is what the bank booked, so that is all this
 * exposes. Reconciliation is its first caller, not its owner.
 *
 * <p>Nothing here names a tenant: the entity carries {@code @TenantId}, so the serving tenant is in the generated
 * SQL. A thread that lost the tenant reads nothing rather than another store's entries.
 */
@Component
@RequiredArgsConstructor
public class BankTransfers {

    private final BankStatementEntryRepository entries;

    /** Every entry this tenant holds booked between two days, both included, oldest first. */
    @Transactional(readOnly = true)
    public List<BankTransfer> bookedBetween(LocalDate from, LocalDate to) {
        return entries.findByBookingDateBetweenOrderByBookingDateAscIdAsc(from, to).stream()
                .map(BankTransfers::transfer)
                .toList();
    }

    private static BankTransfer transfer(BankStatementEntry entry) {
        return BankTransfer.builder()
                .entryReference(entry.getEntryReference())
                .accountIban(entry.getAccountIban())
                .bookingDate(entry.getBookingDate())
                .amount(entry.getAmount())
                .currency(entry.getCurrency())
                .direction(entry.getDirection())
                .counterpartyName(entry.getCounterpartyName())
                .remittanceInformation(entry.getRemittanceInformation())
                .mapping(entry.getMapping())
                .build();
    }
}
