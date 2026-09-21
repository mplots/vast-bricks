package com.vastbricks.api.currencyrate;

import com.vastbricks.api.client.ecb.EcbDailyRates;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Commits one published day, without holding a transaction across the provider call or the entire history. */
@Component
@RequiredArgsConstructor
class CurrencyRateStore {
    private final CurrencyRateRepository repository;

    @Transactional
    boolean storeDay(EcbDailyRates daily) {

        if (repository.existsByRateDate(daily.getRateDate())) {
            // The ECB does not revise a published day, so a repeated sync of the same day is a no-op rather than a
            // merge - and asking per currency would only ever agree with what is already there.
            return false;
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
        return true;
    }
}
