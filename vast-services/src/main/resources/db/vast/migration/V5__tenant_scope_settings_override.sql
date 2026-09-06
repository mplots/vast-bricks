-- The settings profile becomes the tenant. A profile already named one set of provider credentials, so every
-- distinct profile carries over as the tenant that owned it rather than being discarded.
INSERT INTO tenants (code, name)
SELECT DISTINCT LOWER(TRIM(profile)), LOWER(TRIM(profile))
FROM settings_override
WHERE TRIM(profile) <> ''
ON CONFLICT (code) DO NOTHING;

ALTER TABLE settings_override
    ADD COLUMN tenant_id BIGINT REFERENCES tenants (id) ON DELETE CASCADE;

UPDATE settings_override o
SET tenant_id = t.id
FROM tenants t
WHERE t.code = LOWER(TRIM(o.profile));

DELETE FROM settings_override WHERE tenant_id IS NULL;

ALTER TABLE settings_override
    ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE settings_override
    DROP CONSTRAINT IF EXISTS settings_override_profile_setting_key_unique;

ALTER TABLE settings_override
    DROP COLUMN profile;

CREATE UNIQUE INDEX settings_override_tenant_setting_key_unique
    ON settings_override (tenant_id, setting_key);

COMMENT ON TABLE settings_override IS 'Per-tenant setting values overriding the deployment defaults. The first tenant-owned table: rows are filtered by Hibernate''s @TenantId rather than by a WHERE clause any query has to remember.';

-- Existing logins keep serving the store they already served, which is decidable only while there is one store to
-- serve. A deployment that carried several profiles across has several tenants and no basis to guess among them, so
-- its memberships are an operator's to grant.
INSERT INTO user_tenants (user_id, tenant_id)
SELECT u.id, t.id
FROM users u
         CROSS JOIN tenants t
WHERE (SELECT COUNT(*) FROM tenants) = 1
ON CONFLICT DO NOTHING;
