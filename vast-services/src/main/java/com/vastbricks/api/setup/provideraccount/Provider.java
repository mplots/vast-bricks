package com.vastbricks.api.setup.provideraccount;

/** Every external party a tenant can hold an account with. Each has its own {@link ProviderAccountConfig}
 * implementation. */
public enum Provider {
    BRICK_LINK,
    BRICK_OWL,
    LATVIJAS_PASTS,
    MANA_KABATA,
    PAYPAL,
    STRIPE
}
