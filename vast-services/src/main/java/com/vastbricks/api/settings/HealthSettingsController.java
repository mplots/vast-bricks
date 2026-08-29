package com.vastbricks.api.settings;

import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value = "/api/private/settings/health", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class HealthSettingsController {

    private final HealthSettings healthSettings;

    @GetMapping
    HealthSettingsResponse getHealthSettings() {
        return new HealthSettingsResponse(healthSettings.getValue());
    }
}
