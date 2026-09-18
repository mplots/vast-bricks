-- Two real orders' own BrickLink locations named a country by a spelling the seed did not carry: "Czech Republic"
-- rather than the JDK's own "Czechia", and "Turkey" rather than its "Türkiye". Added by evidence, exactly as the
-- table is meant to grow - a country's own row already carries every spelling seeded from the JDK; this is the
-- first spelling added because a real order was found stating it rather than because a language was guessed ahead
-- of one.
UPDATE countries SET search_terms = search_terms || '["Czech Republic"]'::jsonb WHERE code = 'CZ';
UPDATE countries SET search_terms = search_terms || '["Turkey"]'::jsonb WHERE code = 'TR';
