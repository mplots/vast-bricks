package com.vastbricks.api.settings;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
class SettingsEncryption {

    private static final String ENCRYPTION_KEY_ENV = "VAST_SETTINGS_ENCRYPTION_KEY";
    private static final String PAYLOAD_PREFIX = "v1";
    private static final int KEY_BYTES = 32;
    private static final int IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private final Environment environment;
    private final SecureRandom secureRandom = new SecureRandom();

    String encrypt(String plaintext) {
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
            throw new SettingsOverrideException("Failed to encrypt secret setting value.", ex);
        }
    }

    String decrypt(String encryptedValue) {
        String[] parts = encryptedValue.split(":", 3);
        if (parts.length != 3 || !PAYLOAD_PREFIX.equals(parts[0])) {
            throw new SettingsOverrideException("Secret setting value is not a supported encrypted payload.");
        }

        try {
            byte[] iv = Base64.getDecoder().decode(parts[1]);
            byte[] ciphertext = Base64.getDecoder().decode(parts[2]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException | GeneralSecurityException ex) {
            throw new SettingsOverrideException("Failed to decrypt secret setting value.", ex);
        }
    }

    private SecretKeySpec key() {
        String encodedKey = environment.getProperty(ENCRYPTION_KEY_ENV);
        if (encodedKey == null || encodedKey.isBlank()) {
            throw new SettingsOverrideException(ENCRYPTION_KEY_ENV + " is required for secret settings.");
        }

        byte[] key;
        try {
            key = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException ex) {
            throw new SettingsOverrideException(ENCRYPTION_KEY_ENV + " must be base64 encoded.", ex);
        }
        if (key.length != KEY_BYTES) {
            throw new SettingsOverrideException(ENCRYPTION_KEY_ENV + " must be a base64-encoded 32-byte key.");
        }
        return new SecretKeySpec(key, "AES");
    }
}
