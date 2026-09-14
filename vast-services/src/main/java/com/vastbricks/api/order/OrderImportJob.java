package com.vastbricks.api.order;

import com.vastbricks.api.job.Job;
import com.vastbricks.api.job.JobTally;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Reads the store's order archive into the database, whenever the archive has just been written.
 *
 * <p>It declares no cron and follows the archive job instead. Its input is that job's output, so an hour of its own
 * would be a second statement of when the files are ready and would drift the first night the archive ran long. It
 * still runs when someone asks for it, which is what a store catching up an archive by hand wants.
 */
@Component
@RequiredArgsConstructor
class OrderImportJob implements Job {

    private final OrderImport orderImport;

    @Override
    public String code() {
        return "order-import";
    }

    @Override
    public Optional<String> after() {
        return Optional.of("order-archive");
    }

    @Override
    public JobTally run() {
        OrderImport.ImportTally tally = orderImport.importAll();
        return JobTally.empty()
                .count("imported", tally.imported)
                .count("updated", tally.updated)
                .count("unchanged", tally.unchanged)
                .count("failed", tally.failed);
    }
}
