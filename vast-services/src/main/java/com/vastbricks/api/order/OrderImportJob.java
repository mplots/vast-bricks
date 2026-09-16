package com.vastbricks.api.order;

import com.vastbricks.api.job.Job;
import com.vastbricks.api.job.JobParameter;
import com.vastbricks.api.job.JobParameters;
import com.vastbricks.api.job.JobTally;
import java.util.List;
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

    /**
     * Whether to import every archived order rather than only the ones the archive holds a later state of.
     *
     * <p>The ordinary run reads a file only where its moment is later than the row's, which is what makes a nightly
     * run over a whole store's history cheap. It also means a change in how a file is read reaches no row that has
     * not changed since, so the store would have to wait for each order to move before it was read correctly. This
     * is how a person says read it all again: it costs nothing at the marketplaces, the archive being the only
     * thing the import reads.
     */
    static final String FORCE = "force";

    @Override
    public List<JobParameter> parameters() {
        return List.of(JobParameter.flag(FORCE));
    }

    @Override
    public JobTally run(JobParameters parameters) {
        OrderImport.ImportTally tally = orderImport.importAll(parameters.flag(FORCE));
        return JobTally.empty()
                .count("imported", tally.imported)
                .count("updated", tally.updated)
                .count("unchanged", tally.unchanged)
                // The orders that were another store's are no part of it, as they are no part of the archive's own
                // tally. A row removed for being one is reported: it was there, and after this run it is not.
                .count("removed", tally.removed)
                .count("failed", tally.failed);
    }
}
