package com.vastbricks.api.settings;

import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface SettingsOverrideRepository extends JpaRepository<SettingsOverride, Long> {

    Optional<SettingsOverride> findByProfileAndSettingKey(String profile, String settingKey);
}
