package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import java.time.LocalDate;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * The date range a tenant's BrickOwl store actually operated in. An order dated before it opened or after it closed
 * did not happen for this store, so reconciliation must not list it. Either date left unset leaves that side
 * unbounded.
 */
@Component
@Getter
class BrickOwlStoreSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKOWL_OPEN_DATE", databaseOverride = true)
    private LocalDate openDate;

    @VastSetting(env = "VAST_BRICKOWL_CLOSE_DATE", databaseOverride = true)
    private LocalDate closeDate;
}
