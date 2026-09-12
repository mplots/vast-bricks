package com.vastbricks.api.setup.provideraccount;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.vastbricks.api.setup.SetupEncryption;

/**
 * One provider's own configuration shape, including its credentials. {@link ProviderAccountService} only ever calls
 * these methods - it never inspects or names a provider's own fields, so adding a provider means adding a class
 * that implements this interface (with its own {@code jakarta.validation} annotations on its own fields) and one
 * {@link JsonSubTypes.Type} entry below, never a change to the generic service or controller.
 *
 * <p>Self-describing: the stored and the request JSON both carry a {@code provider} property that Jackson uses to
 * pick the concrete class, so the same {@code ProviderAccountConfig} type reads and writes either one.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "provider")
@JsonSubTypes({
        @JsonSubTypes.Type(value = BrickLinkAccountConfig.class, name = "BRICK_LINK"),
        @JsonSubTypes.Type(value = BrickOwlAccountConfig.class, name = "BRICK_OWL"),
        @JsonSubTypes.Type(value = LatvijasPastsAccountConfig.class, name = "LATVIJAS_PASTS"),
        @JsonSubTypes.Type(value = ManaKabataAccountConfig.class, name = "MANA_KABATA"),
        @JsonSubTypes.Type(value = PayPalAccountConfig.class, name = "PAYPAL"),
        @JsonSubTypes.Type(value = StripeAccountConfig.class, name = "STRIPE")
})
interface ProviderAccountConfig {

    Provider provider();

    /**
     * The stretch of this account's data that counts, null when this provider has no such notion - which is every
     * provider but the marketplaces a store's own orders come from.
     *
     * <p>Deliberately not a {@code get...} accessor: it is answered by the config's own field where there is one, and
     * a bean property here would write {@code operatingPeriod: null} into the stored and returned JSON of every
     * provider that has no field for it.
     */
    default OperatingPeriod operatingPeriod() {
        return null;
    }

    /** Returns this config ready to persist: secret fields are encrypted, and a secret left blank keeps whatever
     * {@code existing} already had stored instead of erasing it. {@code existing} is null when creating. */
    ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing);

    /** Returns this stored config as it should be shown to a tenant: a secret field's value is never included,
     * only how many characters it has, so a screen can mask it at its own width. */
    ProviderAccountConfig forView(SetupEncryption encryption);
}
