package com.vastbricks.api.setup.datasource;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.vastbricks.api.setup.SetupEncryption;

/**
 * One provider's own configuration shape, including its credentials. {@link DataSourceService} only ever calls
 * these methods - it never inspects or names a provider's own fields, so adding a provider means adding a class
 * that implements this interface (with its own {@code jakarta.validation} annotations on its own fields) and one
 * {@link JsonSubTypes.Type} entry below, never a change to the generic service or controller.
 *
 * <p>Self-describing: the stored and the request JSON both carry a {@code provider} property that Jackson uses to
 * pick the concrete class, so the same {@code DataSourceConfig} type reads and writes either one.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "provider")
@JsonSubTypes({
        @JsonSubTypes.Type(value = PayPalDataSourceConfig.class, name = "PAYPAL"),
        @JsonSubTypes.Type(value = StripeDataSourceConfig.class, name = "STRIPE")
})
interface DataSourceConfig {

    DataSourceProvider provider();

    /** Returns this config ready to persist: secret fields are encrypted, and a secret left blank keeps whatever
     * {@code existing} already had stored instead of erasing it. {@code existing} is null when creating. */
    DataSourceConfig prepareForStorage(SetupEncryption encryption, DataSourceConfig existing);

    /** Returns this stored config as it should be shown to a tenant: a secret field's value is never included,
     * only how many characters it has, so a screen can mask it at its own width. */
    DataSourceConfig forView(SetupEncryption encryption);
}
