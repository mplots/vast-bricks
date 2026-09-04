package com.vastbricks.api.reconciliation;

/**
 * Mapping stage: turns what one source returned into the reconciled order list. A mapper names no source and calls no
 * client: it declares the sourced class it reads, and the orchestrator hands it what was fetched for that class.
 */
public interface Mapper<T> {

    /** The sourced class this mapper reads. It maps nothing when no source returns that class. */
    Class<T> type();
}
