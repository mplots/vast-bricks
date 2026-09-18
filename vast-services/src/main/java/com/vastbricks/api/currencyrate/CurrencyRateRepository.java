package com.vastbricks.api.currencyrate;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The euro reference rate table.
 *
 * <p>Unlike a tenant-owned repository here, these queries carry no tenant and Hibernate adds none: the entity has no
 * {@code @TenantId} because an ECB rate belongs to no store.
 */
@DependsOn("vastDatabaseMigration")
interface CurrencyRateRepository extends JpaRepository<CurrencyRate, Long> {

    /** Whether a day is already stored in full, which is what makes a repeated sync of the same day a no-op. */
    boolean existsByRateDate(LocalDate rateDate);

    /** The most recently stored row, whatever currency it is for, which is what says whether a sync is due. */
    Optional<CurrencyRate> findFirstByOrderByFetchedAtDesc();

    /** The rate published on or before a date, which is what a rate published for one day answers for every day
     * until the next one is published. */
    Optional<CurrencyRate> findFirstByCurrencyAndRateDateLessThanEqualOrderByRateDateDesc(String currency, LocalDate date);

    /** The earliest rate held for a currency, for a date older than this table's own history. */
    Optional<CurrencyRate> findFirstByCurrencyOrderByRateDateAsc(String currency);
}
