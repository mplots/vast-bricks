package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** BrickOwl's own config: a single secret API key, and the stretch of the store's orders that count. */
@Getter
@Setter
@NoArgsConstructor
class BrickOwlAccountConfig implements ProviderAccountConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String apiKey;

    /** Populated only on a view, alongside a null {@link #apiKey}: how long one is, not what it is. */
    private int apiKeyLength;

    /** The stretch of this store's orders that count, null for all of them. */
    private OperatingPeriod operatingPeriod;

    @Override
    public Provider provider() {
        return Provider.BRICK_OWL;
    }

    @Override
    public OperatingPeriod operatingPeriod() {
        return operatingPeriod;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        BrickOwlAccountConfig previous = existing == null ? new BrickOwlAccountConfig() : (BrickOwlAccountConfig) existing;

        BrickOwlAccountConfig stored = new BrickOwlAccountConfig();
        stored.apiKey = encryption.encryptOrKeep(apiKey, previous.apiKey);
        stored.operatingPeriod = OperatingPeriod.checked(operatingPeriod);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        BrickOwlAccountConfig view = new BrickOwlAccountConfig();
        view.apiKeyLength = encryption.decryptedLength(apiKey);
        view.operatingPeriod = operatingPeriod;
        return view;
    }
}
