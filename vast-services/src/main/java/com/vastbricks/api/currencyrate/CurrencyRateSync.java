package com.vastbricks.api.currencyrate;

import com.vastbricks.api.client.ecb.EcbClient;
import com.vastbricks.api.client.ecb.EcbDailyRates;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fetches the ECB's daily reference rates and stores whatever day it just stated.
 *
 * <p>Provider calls run outside database transactions so debug traffic is visible immediately and survives failures.
 * Each day's rates are committed atomically through CurrencyRateStore, keeping history imports bounded.
 *
 * <p>A row is never rewritten. The ECB does not revise a day once it has published it, so the whole day is stored
 * once, as one unit: a sync that finds today's date already stored writes nothing at all rather than checking each
 * currency in it individually.
 */
@Component
@RequiredArgsConstructor
class CurrencyRateSync {

    /** How recently synced is recent enough to leave alone, the job firing once per tenant over one global table. */
    static final Duration FRESH_FOR = Duration.ofHours(12);

    private final EcbClient client;
    private final CurrencyRateRepository repository;
    private final CurrencyRateStore store;

    /** Whether the table was confirmed recently enough that another sync would ask the ECB the same question again. */
    @Transactional(readOnly = true)
    boolean isFresh() {
        return repository.findFirstByOrderByFetchedAtDesc()
                .map(rate -> rate.getFetchedAt().isAfter(Instant.now().minus(FRESH_FOR)))
                .orElse(false);
    }

    CurrencyRateSyncTally sync() {
        return store(List.of(client.fetchDailyRates()));
    }

    CurrencyRateSyncTally syncHistory() {
        return store(client.fetchHistory());
    }

    private CurrencyRateSyncTally store(List<EcbDailyRates> days) {
        CurrencyRateSyncTally tally = new CurrencyRateSyncTally();
        for (EcbDailyRates daily : days) {
            if (Thread.currentThread().isInterrupted()) break;
            if (store.storeDay(daily)) tally.added += daily.getRates().size();
            else tally.skipped += daily.getRates().size();
        }
        return tally;
    }

}
