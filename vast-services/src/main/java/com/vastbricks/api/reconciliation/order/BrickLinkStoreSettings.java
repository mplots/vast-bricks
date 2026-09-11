package com.vastbricks.api.reconciliation.order;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import java.time.LocalDate;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * The date range a tenant's BrickLink store actually operated in. An order dated before it opened or after it closed
 * did not happen for this store, so reconciliation must not list it. Either date left unset leaves that side
 * unbounded.
 */
@Component
@Getter
class BrickLinkStoreSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKLINK_OPEN_DATE", databaseOverride = true)
    private LocalDate openDate;

    @VastSetting(env = "VAST_BRICKLINK_CLOSE_DATE", databaseOverride = true)
    private LocalDate closeDate;
}
