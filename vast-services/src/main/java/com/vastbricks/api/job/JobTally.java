package com.vastbricks.api.job;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * What a run came to: named counts, in the order the job stated them.
 *
 * <p>Codes and numbers, never a sentence. A tally is shown to a person, so its wording belongs in the portal
 * catalogs keyed by the count's own name, exactly as a reconciliation failure's wording does — a job that returned
 * "archived 3 orders" would be a backend deciding what a screen says, and would only ever say it in one language.
 */
public final class JobTally {

    private final Map<String, Long> counts = new LinkedHashMap<>();

    private JobTally() {
    }

    /** A run that counted nothing. Still a tally: it says the job ran and found nothing to do. */
    public static JobTally empty() {
        return new JobTally();
    }

    /** Adds a count under its own name, keeping the order counts were added in. */
    public JobTally count(String name, long value) {
        counts.put(name, value);
        return this;
    }

    public Map<String, Long> counts() {
        return Collections.unmodifiableMap(counts);
    }
}
