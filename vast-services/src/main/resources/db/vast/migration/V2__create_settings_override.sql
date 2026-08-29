CREATE TABLE IF NOT EXISTS settings_override (
    id BIGSERIAL PRIMARY KEY,
    profile TEXT NOT NULL,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT settings_override_profile_setting_key_unique UNIQUE (profile, setting_key)
);

CREATE INDEX IF NOT EXISTS settings_override_setting_key_idx
    ON settings_override (setting_key);
