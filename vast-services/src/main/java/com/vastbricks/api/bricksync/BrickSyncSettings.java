package com.vastbricks.api.bricksync;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Where BrickSync keeps the orders it has synchronized, which is the {@code orders} directory of its own data
 * directory.
 *
 * <p>Overridable per tenant like the archive, because a tenant that runs its own BrickSync runs it somewhere of its
 * own. Unlike the archive the directory is not split by tenant: BrickSync names a file after the marketplace and the
 * order id and nothing else, so two tenants pointed at one directory read each other's orders.
 */
@Component
@Getter
class BrickSyncSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_BRICKSYNC_ORDERS_DIR", databaseOverride = true)
    private String ordersDirectory = "/tmp/vast-bricks/bricksync-orders";
}
