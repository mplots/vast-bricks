package com.vastbricks.api.client.brickstore;

import com.vastbricks.api.settings.DatabaseBackedSettings;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
class BrickStoreSettings extends DatabaseBackedSettings {

    @Value("${VAST_BRICKSTORE_BASE_URL:https://www.bricklink.com}")
    private String baseUrl;

    @Value("${VAST_BRICKSTORE_TOKEN:}")
    private String token;

    @Value("${VAST_BRICKSTORE_TOR_ENABLED:false}")
    private boolean torEnabled;
}
