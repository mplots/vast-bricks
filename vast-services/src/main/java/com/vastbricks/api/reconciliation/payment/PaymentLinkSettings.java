package com.vastbricks.api.reconciliation.payment;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import com.vastbricks.api.settings.VastSetting;
import lombok.Getter;
import org.springframework.stereotype.Component;

/**
 * Which Stripe account the payment links point into. Stripe addresses a payment under the account that took it, and
 * a balance transaction does not name its own account, so the account has to be stated. This is a decision about the
 * links this feature shows rather than about reaching the API, so it is owned here and not by the client.
 *
 * <p>PayPal needs no counterpart: it addresses a transaction by id alone.
 */
@Component
@Getter
class PaymentLinkSettings extends DatabaseBackedSettings {

    @VastSetting(env = "VAST_STRIPE_ACCOUNT_ID", databaseOverride = true)
    private String stripeAccountId = "";
}
