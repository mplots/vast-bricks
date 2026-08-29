CREATE TABLE IF NOT EXISTS migration_marker (
    id SMALLINT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO migration_marker (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
