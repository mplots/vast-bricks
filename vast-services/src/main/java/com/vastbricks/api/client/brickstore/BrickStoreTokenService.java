package com.vastbricks.api.client.brickstore;

import com.vastbricks.api.settings.VastSettingsWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BrickStoreTokenService {

    private static final String TOKEN_SETTING_KEY = "VAST_BRICKSTORE_TOKEN";

    private final VastSettingsWriter settingsWriter;
    private final BrickStoreClient brickStoreClient;

    public void storeToken(String token) {
        settingsWriter.storeSecret(TOKEN_SETTING_KEY, token.trim());
        brickStoreClient.invalidateSessionToken();
    }

    public void storeDefaultToken(String token) {
        settingsWriter.storeDefaultSecret(TOKEN_SETTING_KEY, token.trim());
        brickStoreClient.invalidateSessionToken();
    }
}
