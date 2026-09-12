package com.vastbricks.api.setup.provideraccount;

import com.vastbricks.api.setup.SetupEncryption;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * BrickLink's own config: the store API's OAuth credentials, and the session token the store pages are read with.
 *
 * <p>Both sets belong to one account because both reach the same BrickLink store. The store API is what BrickLink
 * publishes and signs OAuth requests against; the store pages are what a signed-in member sees, read with a session
 * token because the API does not report everything the pages do. A tenant holds one BrickLink store, so splitting
 * these across two provider accounts would only ask the same store to be configured twice.
 *
 * <p>Every credential here is reported by its length and nothing else. The operating period is not one, so it is
 * read back as it was written.
 */
@Getter
@Setter
@NoArgsConstructor
class BrickLinkAccountConfig implements ProviderAccountConfig {

    /** Plaintext on a request, ciphertext once stored, always null on a view - never the value itself. */
    private String consumerKey;

    private String consumerSecret;

    private String tokenValue;

    private String tokenSecret;

    /** The store pages' session token: a BrickLink credential of a different kind rather than a second provider. */
    private String brickStoreToken;

    /** Populated only on a view, alongside the null secrets above: how long each one is, not what it is. */
    private int consumerKeyLength;

    private int consumerSecretLength;

    private int tokenValueLength;

    private int tokenSecretLength;

    private int brickStoreTokenLength;

    /** The stretch of this store's orders that count, null for all of them. */
    private OperatingPeriod operatingPeriod;

    @Override
    public Provider provider() {
        return Provider.BRICK_LINK;
    }

    @Override
    public OperatingPeriod operatingPeriod() {
        return operatingPeriod;
    }

    @Override
    public ProviderAccountConfig prepareForStorage(SetupEncryption encryption, ProviderAccountConfig existing) {
        BrickLinkAccountConfig previous =
                existing == null ? new BrickLinkAccountConfig() : (BrickLinkAccountConfig) existing;

        BrickLinkAccountConfig stored = new BrickLinkAccountConfig();
        stored.consumerKey = encryption.encryptOrKeep(consumerKey, previous.consumerKey);
        stored.consumerSecret = encryption.encryptOrKeep(consumerSecret, previous.consumerSecret);
        stored.tokenValue = encryption.encryptOrKeep(tokenValue, previous.tokenValue);
        stored.tokenSecret = encryption.encryptOrKeep(tokenSecret, previous.tokenSecret);
        stored.brickStoreToken = encryption.encryptOrKeep(brickStoreToken, previous.brickStoreToken);
        stored.operatingPeriod = OperatingPeriod.checked(operatingPeriod);
        return stored;
    }

    @Override
    public ProviderAccountConfig forView(SetupEncryption encryption) {
        BrickLinkAccountConfig view = new BrickLinkAccountConfig();
        view.consumerKeyLength = encryption.decryptedLength(consumerKey);
        view.consumerSecretLength = encryption.decryptedLength(consumerSecret);
        view.tokenValueLength = encryption.decryptedLength(tokenValue);
        view.tokenSecretLength = encryption.decryptedLength(tokenSecret);
        view.brickStoreTokenLength = encryption.decryptedLength(brickStoreToken);
        view.operatingPeriod = operatingPeriod;
        return view;
    }
}
