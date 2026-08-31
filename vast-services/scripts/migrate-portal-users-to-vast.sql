-- One-time production data migration. Run manually after the Vast schema has
-- been migrated and before switching authentication to vast.users.
--
-- This is deliberately not a Flyway migration: Vast schema migrations must
-- never depend on legacy schemas.
BEGIN;

LOCK TABLE public.portal_user IN SHARE MODE;
LOCK TABLE vast.users IN SHARE ROW EXCLUSIVE MODE;

-- Do not silently merge two distinct accounts that happen to share an email.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.portal_user legacy_user
        JOIN vast.users vast_user ON LOWER(vast_user.email) = LOWER(legacy_user.email)
            AND vast_user.id <> legacy_user.id
    ) THEN
        RAISE EXCEPTION 'Cannot migrate portal users: a Vast user has the same email but a different ID';
    END IF;
END $$;

-- Preserve IDs so JWTs issued by the legacy application remain valid after
-- the new service is configured with the same signing-secret value.
INSERT INTO vast.users (id, email, password_hash, name, role, active, created_at)
SELECT id, email, password_hash, name, role, active, created_at
FROM public.portal_user
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    active = EXCLUDED.active,
    created_at = EXCLUDED.created_at;

-- Advance the identity sequence past the copied legacy IDs.
SELECT setval(
    pg_get_serial_sequence('vast.users', 'id'),
    COALESCE((SELECT MAX(id) FROM vast.users), 1),
    (SELECT COUNT(*) > 0 FROM vast.users)
);

COMMIT;
