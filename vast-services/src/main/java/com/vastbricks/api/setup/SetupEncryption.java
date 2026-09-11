package com.vastbricks.api.setup;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * AES-256-GCM encryption for secret values that must be stored at rest, keyed by {@code VAST_SETUP_ENCRYPTION_KEY}.
 *
 * <p>Lives at the root of the Setup feature rather than inside {@code settings} because both of its subfeatures use
 * it: a {@code @VastSetting(secret = true)} override and a data source's own credential encrypt with this same key
 * rather than each inventing its own.
 */
@Component
@RequiredArgsConstructor
public class SetupEncryption {

    private static final String ENCRYPTION_KEY_ENV = "VAST_SETUP_ENCRYPTION_KEY";
    private static final String PAYLOAD_PREFIX = "v1";
    private static final int KEY_BYTES = 32;
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private final Environment environment;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * Encrypts a newly supplied secret, or keeps the one already stored when the field was left blank - what every
     * screen does with a secret the tenant did not retype, since a secret is never read back to be resubmitted.
     */
    public String encryptOrKeep(String submitted, String stored) {
        return StringUtils.isBlank(submitted) ? stored : encrypt(submitted);
    }

    /**
     * How many characters the secret behind this ciphertext has, or 0 when none is stored - enough for a screen to
     * mask one at its own width without ever being told what it is. The plaintext never leaves this method.
     *
     * <p>Not a disclosure: AES-GCM ciphertext is the plaintext's own length plus a fixed tag, so anyone who can
     * read the stored value can already count it.
     */
    public int decryptedLength(String stored) {
        return StringUtils.isBlank(stored) ? 0 : decrypt(stored).length();
    }

    public String encrypt(String plaintext) {
        byte[] iv = new byte[IV_BYTES];
        secureRandom.nextBytes(iv);

        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return PAYLOAD_PREFIX + ":"
                    + Base64.getEncoder().encodeToString(iv) + ":"
                    + Base64.getEncoder().encodeToString(ciphertext);
        } catch (GeneralSecurityException ex) {
            throw new SetupEncryptionException("Failed to encrypt secret value.", ex);
        }
    }

    public String decrypt(String encryptedValue) {
        String[] parts = encryptedValue.split(":", 3);
        if (parts.length != 3 || !PAYLOAD_PREFIX.equals(parts[0])) {
            throw new SetupEncryptionException("Secret value is not a supported encrypted payload.");
        }

        try {
            byte[] iv = Base64.getDecoder().decode(parts[1]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[2]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException | GeneralSecurityException ex) {
            throw new SetupEncryptionException("Failed to decrypt secret value.", ex);
        }
    }

    private SecretKeySpec key() {
        String encodedKey = environment.getProperty(ENCRYPTION_KEY_ENV);
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new SetupEncryptionException(ENCRYPTION_KEY_ENV + " is required for secret values.");
        }

        byte[] key;
        try {
            key = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException ex) {
            throw new SetupEncryptionException(ENCRYPTION_KEY_ENV + " must be base64 encoded.", ex);
        }
        if (key.length != KEY_BYTES) {
            throw new SetupEncryptionException(ENCRYPTION_KEY_ENV + " must be a base64-encoded 32-byte key.");
        }
        return new SecretKeySpec(key, "AES");
    }
}
