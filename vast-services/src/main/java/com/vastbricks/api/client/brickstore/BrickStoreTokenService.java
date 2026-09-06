package com.vastbricks.api.client.brickstore;

import com.vastbricks.api.settings.VastSettingsWriter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class BrickStoreTokenService {

    private static final String TOKEN_SETTING_KEY = "VAST_BRICKSTORE_TOKEN";

    private final VastSettingsWriter settingsWriter;
    private final BrickStoreClient brickStoreClient;

    @Value("${VAST_LEGACY_TENANT_CODE:}")
    private String legacyTenantCode = "";

    public void storeToken(String token) {
        settingsWriter.storeSecret(TOKEN_SETTING_KEY, token.trim());
        brickStoreClient.invalidateSessionToken();
    }

    /**
     * Stores the token for the store the legacy launcher serves, named by {@code VAST_LEGACY_TENANT_CODE}.
     *
     * <p>The BrickLink browser extension posts a session token under a shared API key, with no user login anywhere in
     * the flow, so the tenant cannot be resolved from the request and has to be stated by configuration. This is the
     * only caller that does so, and it goes when {@code vb-portal-api} does.
     */
    public void storeLegacyToken(String token) {
        settingsWriter.storeSecretForTenant(legacyTenantCode, TOKEN_SETTING_KEY, token.trim());
        brickStoreClient.invalidateSessionToken();
    }
}
