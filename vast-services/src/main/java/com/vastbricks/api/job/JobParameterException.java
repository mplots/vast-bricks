package com.vastbricks.api.job;

/** A run asked for with a parameter the job does not declare, or with a value its type does not allow. */
public class JobParameterException extends RuntimeException {

    public JobParameterException(String message) {
        super(message);
    }
}
