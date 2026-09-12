package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Latvijas Pasts's own config: the two ways one postal account is reached.
 *
 * <p>The shipping API issues packages and documents against an API user and key. The shipment register a store
 * sees is not on that API at all, so reading it means signing in to Mans Pasts self-service as a person would.
 * Both belong to one postal account, so they are configured together rather than as two providers.
 *
 * <p>Every field here is a credential. The two identifying halves are held as secrets alongside the two secret
 * ones rather than shown back, because each names a real postal account; the account's own name is what a tenant
 * tells its cards apart by.
 */
@Getter
@Setter
@NoArgsConstructor
class LatvijasPastsAccountConfig implements ProviderAccountConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String username;

    private String password;

    /** The shipping API's own credentials, which are not the self-service sign-in and are issued separately. */
    private String apiUser;

    private String apiKey;

    /** Populated only on a view, alongside the null secrets above: how long each one is, not what it is. */
    private int usernameLength;

    private int passwordLength;

    private int apiUserLength;

    private int apiKeyLength;

    @Override
    public Provider provider() {
        return Provider.LATVIJAS_PASTS;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        LatvijasPastsAccountConfig previous =
                existing == null ? new LatvijasPastsAccountConfig() : (LatvijasPastsAccountConfig) existing;

        LatvijasPastsAccountConfig stored = new LatvijasPastsAccountConfig();
        stored.username = encryption.encryptOrKeep(username, previous.username);
        stored.password = encryption.encryptOrKeep(password, previous.password);
        stored.apiUser = encryption.encryptOrKeep(apiUser, previous.apiUser);
        stored.apiKey = encryption.encryptOrKeep(apiKey, previous.apiKey);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        LatvijasPastsAccountConfig view = new LatvijasPastsAccountConfig();
        view.usernameLength = encryption.decryptedLength(username);
        view.passwordLength = encryption.decryptedLength(password);
        view.apiUserLength = encryption.decryptedLength(apiUser);
        view.apiKeyLength = encryption.decryptedLength(apiKey);
        return view;
    }
}
