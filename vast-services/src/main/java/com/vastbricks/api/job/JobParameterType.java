package com.vastbricks.api.job;

/**
 * What kind of value a job parameter takes.
 *
 * <p>One kind so far, because one kind is what has been needed. A parameter is declared with its type rather than
 * left as free text so the screen knows what control to draw and the trigger can refuse a value that is not one -
 * a job told {@code force=perhaps} must say so rather than quietly read it as off.
 */
public enum JobParameterType {

    /** True or false, absent meaning false. Stated as {@code true} or {@code false}. */
    BOOLEAN
}
