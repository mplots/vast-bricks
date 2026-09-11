package com.vastbricks.api.setup.settings;

import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface SettingsOverrideRepository extends JpaRepository<SettingsOverride, Long> {

    // No tenant in the signature on purpose: Hibernate adds it from the entity's @TenantId. A tenant named here
    // would be a second, forgettable answer to a question already answered.
    Optional<SettingsOverride> findBySettingKey(String settingKey);

    void deleteBySettingKey(String settingKey);
}
