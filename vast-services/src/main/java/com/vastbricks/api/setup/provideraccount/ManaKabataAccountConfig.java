package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Mana Kabata's own config: a single secret API token. */
@Getter
@Setter
@NoArgsConstructor
class ManaKabataAccountConfig implements ProviderAccountConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String apiToken;

    /** Populated only on a view, alongside a null {@link #apiToken}: how long one is, not what it is. */
    private int apiTokenLength;

    @Override
    public Provider provider() {
        return Provider.MANA_KABATA;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        ManaKabataAccountConfig previous =
                existing == null ? new ManaKabataAccountConfig() : (ManaKabataAccountConfig) existing;

        ManaKabataAccountConfig stored = new ManaKabataAccountConfig();
        stored.apiToken = encryption.encryptOrKeep(apiToken, previous.apiToken);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        ManaKabataAccountConfig view = new ManaKabataAccountConfig();
        view.apiTokenLength = encryption.decryptedLength(apiToken);
        return view;
    }
}
