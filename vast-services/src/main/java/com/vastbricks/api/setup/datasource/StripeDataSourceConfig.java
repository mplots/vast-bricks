package com.vastbricks.api.setup.datasource;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Stripe's own config: a single secret API key. */
@Getter
@Setter
@NoArgsConstructor
class StripeDataSourceConfig implements DataSourceConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String secretKey;

    /** Populated only on a view, alongside a null {@link #secretKey}: how long one is, not what it is. */
    private int secretKeyLength;

    @Override
    public DataSourceProvider provider() {
        return DataSourceProvider.STRIPE;
    }

    @Override
    public DataSourceConfig prepareForStorage(SetupEncryption encryption, DataSourceConfig existing) {
        StripeDataSourceConfig previous = existing == null ? new StripeDataSourceConfig() : (StripeDataSourceConfig) existing;

        StripeDataSourceConfig stored = new StripeDataSourceConfig();
        stored.secretKey = encryption.encryptOrKeep(secretKey, previous.secretKey);
        return stored;
    }

    @Override
    public DataSourceConfig forView(SetupEncryption encryption) {
        StripeDataSourceConfig view = new StripeDataSourceConfig();
        view.secretKeyLength = encryption.decryptedLength(secretKey);
        return view;
    }
}
