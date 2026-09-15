package com.vastbricks.api.job;

import java.util.Map;

/**
 * What one run was asked to do differently, handed to the job as it runs.
 *
 * <p>Always present and usually empty: a cron firing and a job started because another finished both state nothing,
 * and a job reads a parameter nobody set as its own default. So a job never asks whether it was given parameters,
 * only what they say.
 *
 * <p>Values are held as the caller stated them and read through the accessor for the type the job declared, which
 * is the only place a spelling becomes a value. Nothing reaches here unvalidated: the trigger has already refused a
 * parameter the job does not declare and a value its type does not allow.
 */
public final class JobParameters {

    private static final JobParameters NONE = new JobParameters(Map.of());

    private final Map<String, String> stated;

    private JobParameters(Map<String, String> stated) {
        this.stated = stated;
    }

    /** What a run nobody asked anything of is given. */
    public static JobParameters none() {
        return NONE;
    }

    static JobParameters of(Map<String, String> stated) {
        return stated == null || stated.isEmpty() ? NONE : new JobParameters(Map.copyOf(stated));
    }

    /** Whether the flag of that name was turned on. False for one nobody stated, which is a flag's own default. */
    public boolean flag(String name) {
        return Boolean.parseBoolean(stated.get(name));
    }
}
