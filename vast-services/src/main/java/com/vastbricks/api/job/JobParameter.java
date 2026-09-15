package com.vastbricks.api.job;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * One parameter a job accepts, as the job declares it.
 *
 * <p>Declared rather than read out of whatever the caller sent, for the same reason a job declares its code: a
 * parameter nothing declares is a typo, and a typo that silently did nothing would be indistinguishable from a job
 * that ignored the request. The declaration is also what a screen draws its controls from.
 */
@Getter
@AllArgsConstructor
public class JobParameter {

    private final String name;

    private final JobParameterType type;

    /** A parameter that is either on or off, and off when the caller says nothing about it. */
    public static JobParameter flag(String name) {
        return new JobParameter(name, JobParameterType.BOOLEAN);
    }
}
