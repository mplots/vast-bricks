package com.vastbricks.api.bankstatement;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface BankStatementEntryRepository extends JpaRepository<BankStatementEntry, Long> {

    // No tenant in either signature on purpose: Hibernate adds it from the entity's @TenantId. A tenant named here
    // would be a second, forgettable answer to a question already answered.

    /** The entry a re-import is about to write again, if this account already holds one under that reference. */
    Optional<BankStatementEntry> findByAccountIbanAndEntryReference(String accountIban, String entryReference);

    List<BankStatementEntry> findByBookingDateBetweenOrderByBookingDateAscIdAsc(LocalDate from, LocalDate to);
}
