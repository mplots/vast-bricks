package com.vastbricks.api.setup.provideraccount;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

/**
 * One stretch of an account's life whose data the platform takes into account.
 *
 * <p>An account can hold data that was never this business's: a store operated privately before it was a store, or
 * after it stopped being one. The tenant draws the periods that count, and everything dated outside them is not this
 * account's data as far as the platform is concerned. Stating no periods at all restricts nothing, which is what
 * every account starts as.
 *
 * <p>Both ends are inclusive and either may be left unstated: no {@code from} is since forever, no {@code to} is
 * ongoing - which the current period always is. Stating neither is refused, because that says exactly what stating
 * no periods already says.
 *
 * <p>Nothing reads these yet. When sourcing does, it is these that a store's order dates are narrowed by, in place of
 * the single {@code VAST_BRICKLINK_OPEN_DATE}/{@code VAST_BRICKLINK_CLOSE_DATE} pair reconciliation clamps by today.
 */
@Getter
@Setter
@NoArgsConstructor
class OperatingPeriod {

    private static final int NOTE_LIMIT = 200;

    /** Unstated sorts to the edge it means: no start is earliest, no end is latest. */
    private static final Comparator<OperatingPeriod> BY_DATES = Comparator
            .comparing(OperatingPeriod::getFrom, Comparator.nullsFirst(Comparator.<LocalDate>naturalOrder()))
            .thenComparing(OperatingPeriod::getTo, Comparator.nullsLast(Comparator.<LocalDate>naturalOrder()));

    /** The first date that counts, inclusive. Null for since forever. */
    private LocalDate from;

    /** The last date that counts, inclusive. Null for ongoing. */
    private LocalDate to;

    /** Why this period was drawn, e.g. "personal, before switching to business". The tenant's own note, optional. */
    private String note;

    /**
     * The periods as they are stored: each one checked, the list sorted, and no two of them overlapping.
     *
     * <p>Sorting first is what makes the overlap check a single pass over adjacent pairs, and storing them sorted is
     * what lets the screen read them back in the order they happened rather than the order they were typed. Touching
     * periods are left as two - the tenant said two, and a period that ends where the next begins may well be the
     * distinction being drawn.
     */
    static List<OperatingPeriod> normalized(List<OperatingPeriod> periods) {
        if (periods == null || periods.isEmpty()) {
            return List.of();
        }

        List<OperatingPeriod> sorted = periods.stream().map(OperatingPeriod::checked).sorted(BY_DATES).toList();
        for (int position = 1; position < sorted.size(); position++) {
            OperatingPeriod previous = sorted.get(position - 1);
            OperatingPeriod current = sorted.get(position);
            // An unstated end runs to forever and an unstated start from forever, so either one beside a neighbour
            // is an overlap. Identical periods fail here too, which is why duplicates need no rule of their own.
            if (previous.to == null || current.from == null || !previous.to.isBefore(current.from)) {
                throw new ProviderAccountException("Operating periods must not overlap: " + previous.describe()
                        + " overlaps " + current.describe() + ".");
            }
        }
        return sorted;
    }

    private static OperatingPeriod checked(OperatingPeriod period) {
        if (period == null || (period.from == null && period.to == null)) {
            throw new ProviderAccountException("An operating period must state a start date, an end date, or both.");
        }
        if (period.from != null && period.to != null && period.from.isAfter(period.to)) {
            throw new ProviderAccountException(
                    "An operating period cannot end on " + period.to + " when it starts on " + period.from + ".");
        }

        String note = StringUtils.trimToNull(period.note);
        if (note != null && note.length() > NOTE_LIMIT) {
            throw new ProviderAccountException(
                    "An operating period note cannot be longer than " + NOTE_LIMIT + " characters.");
        }

        OperatingPeriod stored = new OperatingPeriod();
        stored.from = period.from;
        stored.to = period.to;
        stored.note = note;
        return stored;
    }

    /** How a period reads in a refusal, unstated ends and all. */
    private String describe() {
        return (from == null ? "the beginning" : from.toString()) + " to " + (to == null ? "now" : to.toString());
    }
}
