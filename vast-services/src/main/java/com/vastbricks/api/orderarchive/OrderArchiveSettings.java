package com.vastbricks.api.orderarchive;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Where archived orders are written.
 *
 * <p>Overridable per tenant, because a store's archive is the store's: what is written under it is a marketplace's
 * own record of who bought what, and two stores sharing a directory would archive over each other's order ids.
 */
@Component
@Getter
class OrderArchiveSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_ORDER_ARCHIVE_DIR", databaseOverride = true)
    private String directory = "/tmp/vast-bricks/order-archive";
}
