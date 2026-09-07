package com.vastbricks.api.bankstatement;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@DependsOn("vastDatabaseMigration")
interface BankStatementEntryRepository extends JpaRepository<BankStatementEntry, Long> {

    // No tenant in any signature on purpose: Hibernate adds it from the entity's @TenantId, to the SQL of the query
    // below as much as to a derived one. A tenant named here would be a second, forgettable answer to a question
    // already answered.

    /** The entry a re-import is about to write again, if this account already holds one under that reference. */
    Optional<BankStatementEntry> findByAccountIbanAndEntryReference(String accountIban, String entryReference);

    List<BankStatementEntry> findByBookingDateBetweenOrderByBookingDateAscIdAsc(LocalDate from, LocalDate to);

    /**
     * What each currency has moved, each way, from the first entry stored up to and including a day.
     *
     * <p>This is what the closing balance is derived from, so it deliberately reaches back past the period on screen:
     * a balance is everything that ever happened to the account, not what happened this month. It is summed in the
     * database rather than by loading the rows, because the range it covers grows with every import while what is
     * wanted out of it stays two numbers per currency.
     */
    @Query("""
            select entry.currency as currency, entry.direction as direction, sum(entry.amount) as total
            from BankStatementEntry entry
            where entry.bookingDate <= :until
            group by entry.currency, entry.direction
            """)
    List<DirectionTotal> totalsUpTo(@Param("until") LocalDate until);

    /** One currency's total in one direction, which is all the sum above is read for. */
    interface DirectionTotal {

        String getCurrency();

        BankStatementDirection getDirection();

        BigDecimal getTotal();
    }
}
