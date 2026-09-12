package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Stripe's own config: a single secret API key. */
@Getter
@Setter
@NoArgsConstructor
class StripeAccountConfig implements ProviderAccountConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String secretKey;

    /** Populated only on a view, alongside a null {@link #secretKey}: how long one is, not what it is. */
    private int secretKeyLength;

    @Override
    public Provider provider() {
        return Provider.STRIPE;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        StripeAccountConfig previous = existing == null ? new StripeAccountConfig() : (StripeAccountConfig) existing;

        StripeAccountConfig stored = new StripeAccountConfig();
        stored.secretKey = encryption.encryptOrKeep(secretKey, previous.secretKey);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        StripeAccountConfig view = new StripeAccountConfig();
        view.secretKeyLength = encryption.decryptedLength(secretKey);
        return view;
    }
}
