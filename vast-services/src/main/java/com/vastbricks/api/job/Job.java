package com.vastbricks.api.job;

import java.util.Optional;

/**
 * A unit of work that runs on a schedule, for one tenant at a time.
 *
 * <p>The whole of what it takes to add a job. An implementation lives in its own feature package, beside the code it
 * drives, the way a reconciliation source lives in its category package — this package holds the boundary, the run
 * store and the screen's endpoints, and never a job. Registering one is declaring it a Spring bean; nothing here
 * changes for it.
 *
 * <p>A job is stopped by interrupting the thread it runs on, which is all the JVM offers: a run someone cancels is
 * asked to stop rather than killed. A job that works through a list should check {@link Thread#isInterrupted()}
 * between items and return what it has, and one that blocks should let the interruption out; a job that does
 * neither runs to the end and is recorded as cancelled all the same.
 *
 * <p>A job is tenant-specific. {@link #run()} is called with a tenant already bound to the calling thread, so an
 * implementation reads that tenant's settings and provider credentials without asking whose run it is: a cron fires
 * it once per active tenant, and the portal fires it for the tenant the caller is serving.
 */
public interface Job {

    /** Stable identity of the job, used in its URL and as the key its runs are stored under. */
    String code();

    /** The cron the scheduler fires it on, or empty for a job that only ever runs when someone asks for it. */
    default Optional<String> cron() {
        return Optional.empty();
    }

    /** Runs for the bound tenant and returns what it came to. Throwing is how a run fails. */
    JobTally run();
}
