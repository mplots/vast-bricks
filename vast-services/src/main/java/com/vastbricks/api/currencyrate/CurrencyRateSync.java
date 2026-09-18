package com.vastbricks.api.currencyrate;

import com.vastbricks.api.client.ecb.EcbClient;
import com.vastbricks.api.client.ecb.EcbDailyRates;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fetches the ECB's daily reference rates and stores whatever day it just stated.
 *
 * <p>One HTTP call and a handful of rows, unlike the shipping price sweep this otherwise follows the shape of - so
 * unlike {@code ShippingPriceStore}, there is no per-item transaction here: there is nothing worth failing partway
 * through, and the whole sync is one small write.
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

    /** Whether the table was confirmed recently enough that another sync would ask the ECB the same question again. */
    @Transactional(readOnly = true)
    boolean isFresh() {
        return repository.findFirstByOrderByFetchedAtDesc()
                .map(rate -> rate.getFetchedAt().isAfter(Instant.now().minus(FRESH_FOR)))
                .orElse(false);
    }

    @Transactional
    CurrencyRateSyncTally sync() {
        EcbDailyRates daily = client.fetchDailyRates();
        CurrencyRateSyncTally tally = new CurrencyRateSyncTally();

        if (repository.existsByRateDate(daily.getRateDate())) {
            // The ECB does not revise a published day, so a repeated sync of the same day is a no-op rather than a
            // merge - and asking per currency would only ever agree with what is already there.
            tally.skipped = daily.getRates().size();
            return tally;
        }

        Instant fetchedAt = Instant.now();
        List<CurrencyRate> rows = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : daily.getRates().entrySet()) {
            CurrencyRate row = new CurrencyRate();
            row.setCurrency(entry.getKey());
            row.setRateDate(daily.getRateDate());
            row.setRate(entry.getValue());
            row.setFetchedAt(fetchedAt);
            rows.add(row);
        }
        repository.saveAll(rows);
        tally.added = rows.size();
        return tally;
    }
}
