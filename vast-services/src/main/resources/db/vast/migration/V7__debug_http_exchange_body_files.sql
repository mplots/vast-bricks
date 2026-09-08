ALTER TABLE debug_http_exchanges
    ADD COLUMN request_body_file          BYTEA,
    ADD COLUMN request_body_content_type  VARCHAR(255),
    ADD COLUMN response_body_file         BYTEA,
    ADD COLUMN response_body_content_type VARCHAR(255);

COMMENT ON COLUMN debug_http_exchanges.request_body_file IS 'A request body that was not text, kept as it arrived so the debug panel can hand it over; the body column holds a note about it instead';
COMMENT ON COLUMN debug_http_exchanges.response_body_file IS 'A response body that was not text, kept as it arrived so the debug panel can hand it over; the body column holds a note about it instead';
