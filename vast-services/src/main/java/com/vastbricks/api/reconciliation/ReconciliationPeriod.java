package com.vastbricks.api.reconciliation;

import java.time.LocalDate;
import java.util.Objects;
import lombok.Getter;
import lombok.ToString;

/** The inclusive order dates to collect and reconcile together, including across month boundaries. */
@Getter
@ToString
public final class ReconciliationPeriod {

    private final LocalDate from;
    private final LocalDate to;

    public ReconciliationPeriod(LocalDate from, LocalDate to) {
        this.from = Objects.requireNonNull(from, "from");
        this.to = Objects.requireNonNull(to, "to");
        if (from.isAfter(to)) {
            throw new IllegalArgumentException("from must not be after to");
        }
    }

    public boolean contains(LocalDate date) {
        return date != null && !date.isBefore(from) && !date.isAfter(to);
    }
}
