package com.vastbricks.api.setup.settings;

import com.vastbricks.api.setup.SetupEncryption;
import com.vastbricks.api.tenancy.TenantAccess;
import com.vastbricks.api.tenancy.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VastSettingsWriter {

    private final SettingsOverrideRepository settingsOverrideRepository;
    private final SetupEncryption settingsEncryption;
    private final TenantAccess tenantAccess;

    /** Stores the value for the tenant this request serves, encrypted only when the setting is marked secret. */
    @Transactional
    public void store(String settingKey, String settingValue, boolean secret) {
        storeValue(settingKey, secret ? settingsEncryption.encrypt(settingValue) : settingValue);
    }

    /** Stores the value for the tenant this request serves. */
    @Transactional
    public void storeSecret(String settingKey, String settingValue) {
        store(settingKey, settingValue, true);
    }

    /**
     * Stores the value for the tenant with this code, whichever tenant the caller is serving.
     *
     * <p>For a caller that knows which store it acts for without a login behind it — today only the legacy BrickLink
     * extension endpoint. It names the tenant outright and fails when that tenant does not exist, rather than
     * falling back to one. Writing to another tenant means binding it, because Hibernate stamps the bound tenant on
     * insert and the column is the app's to choose only through the context.
     */
    @Transactional
    public void storeSecretForTenant(String tenantCode, String settingKey, String settingValue) {
        Long tenantId = tenantAccess.tenantIdByCode(tenantCode)
                .orElseThrow(() -> new SettingsOverrideException(
                        "No active tenant with code '" + tenantCode + "' to store settings for."));

        Long previous = TenantContext.currentTenantId().orElse(null);
        TenantContext.setTenantId(tenantId);
        try {
            store(settingKey, settingValue, true);
        } finally {
            TenantContext.setTenantId(previous);
        }
    }

    /** Clears the tenant's own override, so the setting falls back to the environment or its compile-time default. */
    @Transactional
    public void remove(String settingKey) {
        if (TenantContext.currentTenantId().isEmpty()) {
            throw new SettingsOverrideException("No tenant is bound to remove setting overrides for.");
        }
        settingsOverrideRepository.deleteBySettingKey(settingKey);
    }

    private void storeValue(String settingKey, String settingValue) {
        if (TenantContext.currentTenantId().isEmpty()) {
            throw new SettingsOverrideException("No tenant is bound to store setting overrides for.");
        }

        SettingsOverride override = settingsOverrideRepository.findBySettingKey(settingKey)
                .orElseGet(() -> new SettingsOverride(settingKey, settingValue));
        override.setSettingValue(settingValue);
        settingsOverrideRepository.save(override);
    }
}
