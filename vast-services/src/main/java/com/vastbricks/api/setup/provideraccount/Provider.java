package com.vastbricks.api.setup.provideraccount;

/** Every external party a tenant can hold an account with. Each has its own {@link ProviderAccountConfig}
 * implementation. */
public enum Provider {
    BRICK_LINK(false),
    BRICK_OWL(false),
    LATVIJAS_PASTS(false),
    MANA_KABATA(false),
    PAYPAL(true),
    STRIPE(true);

    private final boolean multipleAccounts;

    Provider(boolean multipleAccounts) {
        this.multipleAccounts = multipleAccounts;
    }

    /**
     * Whether a tenant can hold more than one account with this provider.
     *
     * <p>Only the payment gateways: one store collects through as many Stripe or PayPal accounts as it has opened, and
     * which one an order was paid into is a fact about the order. Everything else is a party a tenant deals with once -
     * one BrickLink store, one BrickOwl store, one postal contract, one accounting login - and a second account for one
     * of those would be the same party configured twice rather than a second party.
     */
    boolean allowsMultipleAccounts() {
        return multipleAccounts;
    }
}
