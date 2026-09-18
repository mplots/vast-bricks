package com.vastbricks.api.currencyrate;

import com.vastbricks.api.job.Job;
import com.vastbricks.api.job.JobParameter;
import com.vastbricks.api.job.JobParameters;
import com.vastbricks.api.job.JobTally;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Syncs the European Central Bank's daily euro reference rates into the table, once a day.
 *
 * <p>A job is fired once per active tenant, and this one writes a table no tenant owns - the same idiom
 * {@code ShippingPriceSyncJob} uses. So it is idempotent about being fired repeatedly: a run that finds the table
 * already synced inside the freshness window does nothing at all, which costs the second tenant's firing one query.
 * {@link #FORCE} is how a person asks for the sync anyway.
 */
@Component
@RequiredArgsConstructor
class CurrencyRateSyncJob implements Job {

    /** Sync even though the table was synced recently. How a person asks for it outside the schedule. */
    static final String FORCE = "force";

    private final CurrencyRateSync sync;

    @Override
    public String code() {
        return "currency-rate-sync";
    }

    @Override
    public Optional<String> cron() {
        // 18:00, well after the ECB's own publication around 16:00 CET on a TARGET business day. A weekend or a
        // bank holiday firing finds that day already stated - the ECB does not restate a day it already gave - and
        // costs one query.
        return Optional.of("0 0 18 * * *");
    }

    @Override
    public List<JobParameter> parameters() {
        return List.of(JobParameter.flag(FORCE));
    }

    @Override
    public JobTally run(JobParameters parameters) {
        if (!parameters.flag(FORCE) && sync.isFresh()) {
            // Another tenant's firing already synced it. Reported as a run that did nothing rather than as a
            // failure, because nothing went wrong: the answer was already there.
            return JobTally.empty().count("skipped-fresh", 1);
        }

        CurrencyRateSyncTally tally = sync.sync();
        return JobTally.empty()
                .count("added", tally.getAdded())
                .count("skipped", tally.getSkipped());
    }
}
