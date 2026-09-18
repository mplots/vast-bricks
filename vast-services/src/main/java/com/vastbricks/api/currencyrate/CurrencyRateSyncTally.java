package com.vastbricks.api.currencyrate;

import lombok.Getter;

/** What a sync came to. */
@Getter
class CurrencyRateSyncTally {

    /** Currency rates newly stored. */
    int added;

    /** Currencies left unstored because the ECB's day was already stored in full. */
    int skipped;
}
