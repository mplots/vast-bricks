ALTER TABLE bsx_document
    ADD COLUMN IF NOT EXISTS document_type VARCHAR;

UPDATE bsx_document
SET document_type = CASE
    WHEN filename ILIKE 'bricksync%' THEN 'INVENTORY'
    WHEN filename ILIKE 'bricklink%' THEN 'ORDER'
    WHEN filename ILIKE 'brickowl%' THEN 'ORDER'
    ELSE 'ORDER'
END
WHERE document_type IS NULL;

ALTER TABLE bsx_document
    ALTER COLUMN document_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bsx_document_type ON bsx_document (document_type);
