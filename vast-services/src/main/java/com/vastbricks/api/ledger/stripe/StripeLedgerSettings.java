package com.vastbricks.api.ledger.stripe;

import com.vastbricks.api.setup.settings.DatabaseBackedSettings;
import com.vastbricks.api.setup.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Which Stripe account this screen's links point into. Stripe addresses a payment under the account that took it and
 * a balance transaction does not name its own account, so the account has to be stated.
 *
 * <p>It is the same setting the reconciliation payment links read, for the same reason. Each feature declares the
 * value it needs rather than one of them reaching into the other's settings class: a setting is read per bean, so two
 * features naming one environment variable is how a shared piece of configuration is shared here.
 */
@Component
@Getter
class StripeLedgerSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_STRIPE_ACCOUNT_ID", databaseOverride = true)
    private String accountId = "";
}
