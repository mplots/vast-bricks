package com.vastbricks.api.settings;

import com.vastbricks.api.settings.SettingsPayload.VastSettingsResponse;
import com.vastbricks.api.settings.SettingsPayload.VastSettingsUpdateRequest;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The tenant-facing settings screen: every database-overridable {@code @VastSetting} across the app, in one place. */
@RestController
@RequestMapping(value = "/api/private/settings/vast", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
class VastSettingsController {

    private final VastSettingRegistry registry;
    private final VastSettingsWriter settingsWriter;

    @GetMapping
    VastSettingsResponse getSettings() {
        return new VastSettingsResponse(registry.describe());
    }

    /**
     * Applies every value the tenant supplied, skipping blanks so a secret left empty in the form keeps whatever is
     * already stored rather than being overwritten with nothing.
     */
    @PutMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    VastSettingsResponse updateSettings(@RequestBody VastSettingsUpdateRequest request) {
        for (Map.Entry<String, String> value : request.getValues().entrySet()) {
            applyIfPresent(value.getKey(), value.getValue());
        }
        return getSettings();
    }

    /** Clears the tenant's override for one setting, falling back to whatever the environment or default provides. */
    @DeleteMapping("/{settingKey}")
    VastSettingsResponse resetSetting(@PathVariable("settingKey") String settingKey) {
        if (!registry.isKnown(settingKey)) {
            throw new SettingsOverrideException("Unknown setting key '" + settingKey + "'.");
        }
        settingsWriter.remove(settingKey);
        return getSettings();
    }

    private void applyIfPresent(String settingKey, String settingValue) {
        if (settingValue == null || settingValue.isBlank()) {
            return;
        }
        if (!registry.isKnown(settingKey)) {
            throw new SettingsOverrideException("Unknown setting key '" + settingKey + "'.");
        }
        settingsWriter.store(settingKey, settingValue, registry.isSecret(settingKey));
    }

    @ExceptionHandler(SettingsOverrideException.class)
    ProblemDetail handleSettingsError(SettingsOverrideException exception) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, exception.getMessage());
        problem.setTitle("Invalid setting");
        return problem;
    }
}
