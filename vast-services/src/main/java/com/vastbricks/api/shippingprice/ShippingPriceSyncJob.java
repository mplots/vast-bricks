package com.vastbricks.api.shippingprice;

import com.vastbricks.api.job.Job;
import com.vastbricks.api.job.JobParameter;
import com.vastbricks.api.job.JobParameters;
import com.vastbricks.api.job.JobTally;
import java.util.List;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Sweeps the Latvijas Pasts tariff into the table, weekly.
 *
 * <p>Weekly rather than nightly because a tariff is set by a regulator's decision and moves about once a year; a
 * nightly sweep would ask fifty-two times for each answer that changes.
 *
 * <p>A job is fired once per active tenant, and this one writes a table no tenant owns. So it is idempotent about
 * being fired repeatedly: a run that finds the table already swept inside the freshness window does nothing at all,
 * which costs the second store's firing one query. {@link #FORCE} is how a person asks for the sweep anyway.
 */
@Component
@RequiredArgsConstructor
class ShippingPriceSyncJob implements Job {

    /** Sweep even though the table was swept recently. How a person asks after hearing a tariff changed. */
    static final String FORCE = "force";

    private final ShippingPriceSync sync;

    @Override
    public String code() {
        return "shipping-price-sync";
    }

    @Override
    public Optional<String> cron() {
        // Sunday at 04:00, after the nightly archive and import have had the small hours to themselves.
        return Optional.of("0 0 4 * * SUN");
    }

    @Override
    public List<JobParameter> parameters() {
        return List.of(JobParameter.flag(FORCE));
    }

    @Override
    public JobTally run(JobParameters parameters) {
        if (!parameters.flag(FORCE) && sync.isFresh()) {
            // Another tenant's firing already swept it. Reported as a run that did nothing rather than as a failure,
            // because nothing went wrong: the answer was already there.
            return JobTally.empty().count("skipped-fresh", 1);
        }

        ShippingPriceSyncTally tally = sync.sweep();
        return JobTally.empty()
                .count("added", tally.getAdded())
                .count("changed", tally.getChanged())
                .count("unchanged", tally.getUnchanged())
                .count("skipped", tally.getSkipped())
                .count("closed", tally.getClosed());
    }
}
