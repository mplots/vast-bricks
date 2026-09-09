package com.vastbricks.api.orderarchive;

import com.vastbricks.api.job.Job;
import com.vastbricks.api.job.JobTally;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Archives the store's BrickLink orders nightly.
 *
 * <p>The whole of registering a job: a bean implementing {@link Job}, in the feature package of the work it does.
 * It runs for the tenant bound to the thread, which the schedule fires for every store and the portal for one.
 */
@Component
@RequiredArgsConstructor
class OrderArchiveJob implements Job {

    private final OrderArchive archive;

    @Override
    public String code() {
        return "bricklink-order-archive";
    }

    @Override
    public Optional<String> cron() {
        return Optional.of("0 0 3 * * *");
    }

    @Override
    public JobTally run() {
        OrderArchive.ArchiveTally tally = archive.archiveAll();
        return JobTally.empty()
                .count("archived", tally.archived)
                .count("unchanged", tally.unchanged)
                .count("failed", tally.failed);
    }
}
