package com.vastbricks.api.job;

import java.util.List;
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

    /**
     * The code of the job this one follows, or empty for a job nothing starts on its own.
     *
     * <p>For work whose input is another job's output: a cron of its own would be a second statement of when that
     * input is ready, and the two would drift the first time the leader took longer than the gap between them. The
     * follower starts for the same tenant, under the same trigger the leader ran under, once the leader's run has
     * been written down - so a nightly archive is followed by a nightly import, and a person running the archive by
     * hand gets the import by hand too.
     *
     * <p>A leader that failed is still followed: it may have got through most of its work before it stopped, and
     * that work is the follower's input. A leader someone stopped by hand is not, a stopped run being an
     * intervention rather than a finished one. A follower declaring a cron as well is scheduled by both.
     */
    default Optional<String> after() {
        return Optional.empty();
    }

    /**
     * The parameters this job accepts, empty for a job that takes none.
     *
     * <p>A run is normally asked for with nothing said, and a job that declares a parameter still has to work when
     * nobody states it - a cron and a follower state nothing, ever. So a parameter is something a person asks for
     * on top of what the job does anyway, never something it needs to run at all.
     */
    default List<JobParameter> parameters() {
        return List.of();
    }

    /**
     * Runs for the bound tenant and returns what it came to. Throwing is how a run fails.
     *
     * <p>The parameters are whatever this run was asked for, already checked against what this job declares, and
     * empty for every run nobody asked anything of.
     */
    JobTally run(JobParameters parameters);
}
