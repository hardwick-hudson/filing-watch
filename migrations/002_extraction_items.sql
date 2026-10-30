BEGIN;

CREATE TABLE extraction_items
(
    id            SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
    item_number   TEXT    NOT NULL,
    description   TEXT,
    excerpt       TEXT,
    UNIQUE (extraction_id, item_number)
);

DROP TABLE extraction_excerpts;

ALTER TABLE extractions DROP COLUMN event_category;

COMMIT;