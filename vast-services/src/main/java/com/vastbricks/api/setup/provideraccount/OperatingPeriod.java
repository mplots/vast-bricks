package com.vastbricks.api.setup.provideraccount;

import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * The stretch of a store account's life whose data the platform takes into account.
 *
 * <p>A store's account can hold orders that were never this business's: sold privately before the store was a store,
 * or after it stopped being one. The tenant states the one stretch that counts, and everything dated outside it is not
 * this account's data as far as the platform is concerned. Stating no period restricts nothing, which is what every
 * account starts as.
 *
 * <p>It is a field of the marketplace configs that have one rather than of the account itself: a gateway, bank or
 * carrier account is reached for what a store order already points at, so it has no history of its own to bound, and
 * a config without this field is a provider without the notion.
 *
 * <p>Both ends are inclusive and either may be left unstated: no {@code from} is since forever, no {@code to} is
 * ongoing - which the current period always is. Neither stated is no period at all, which is exactly what it says.
 *
 * <p>Reconciliation narrows a store's order dates by it - see {@link ProviderAccounts} - which is why the class itself
 * is public while everything that stores one stays package-private.
 */
@Getter
@Setter
@NoArgsConstructor
public class OperatingPeriod {

    /** The first date that counts, inclusive. Null for since forever. */
    private LocalDate from;

    /** The last date that counts, inclusive. Null for ongoing. */
    private LocalDate to;

    /**
     * Whether a date falls outside the stretch that counts, and so belongs to whoever else held the login.
     *
     * <p>Both ends are inclusive, and an end left unstated bounds nothing on that side. A date that could not be read
     * at all is not excluded: what reads a period is copying or storing what a marketplace already holds, and a copy
     * too many is a far smaller wrong than a missing one.
     */
    public boolean excludes(LocalDate day) {
        if (day == null) {
            return false;
        }
        return (from != null && day.isBefore(from)) || (to != null && day.isAfter(to));
    }

    /**
     * The period as it is stored, or null when the account states none.
     *
     * <p>A period with neither date is none rather than a refusal: a screen that always shows the two pickers says
     * "no restriction" by clearing them, and that is the same account as one that never stated a period at all.
     */
    static OperatingPeriod checked(OperatingPeriod period) {
        if (period == null || (period.from == null && period.to == null)) {
            return null;
        }
        if (period.from != null && period.to != null && period.from.isAfter(period.to)) {
            throw new ProviderAccountException(
                    "An operating period cannot end on " + period.to + " when it starts on " + period.from + ".");
        }

        OperatingPeriod stored = new OperatingPeriod();
        stored.from = period.from;
        stored.to = period.to;
        return stored;
    }
}
