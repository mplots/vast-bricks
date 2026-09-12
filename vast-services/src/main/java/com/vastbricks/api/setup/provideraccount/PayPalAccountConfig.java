package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** PayPal's own config: a client id and secret, and which PayPal environment they belong to. */
@Getter
@Setter
@NoArgsConstructor
class PayPalAccountConfig implements ProviderAccountConfig {

    @NotBlank
    private String clientId;

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String clientSecret;

    @NotNull
    private PayPalMode mode;

    /** Populated only on a view, alongside a null {@link #clientSecret}: how long one is, not what it is. */
    private int clientSecretLength;

    @Override
    public Provider provider() {
        return Provider.PAYPAL;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        PayPalAccountConfig previous = existing == null ? new PayPalAccountConfig() : (PayPalAccountConfig) existing;

        PayPalAccountConfig stored = new PayPalAccountConfig();
        stored.clientId = clientId;
        stored.mode = mode;
        stored.clientSecret = encryption.encryptOrKeep(clientSecret, previous.clientSecret);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        PayPalAccountConfig view = new PayPalAccountConfig();
        view.clientId = clientId;
        view.mode = mode;
        view.clientSecretLength = encryption.decryptedLength(clientSecret);
        return view;
    }
}
