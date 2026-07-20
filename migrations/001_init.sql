CREATE TABLE companies
(
    cik    TEXT PRIMARY KEY,
    ticker TEXT,
    name   TEXT NOT NULL
);

CREATE TABLE filings
(
    id           SERIAL PRIMARY KEY,
    accession_no TEXT UNIQUE NOT NULL,
    cik          TEXT        NOT NULL REFERENCES companies (cik),
    form_type    TEXT        NOT NULL,
    filed_at     DATE        NOT NULL,
    source_url   TEXT        NOT NULL,
    raw_text     TEXT
);

CREATE TABLE extractions
(
    id                SERIAL PRIMARY KEY,
    filing_id         INTEGER     NOT NULL REFERENCES filings (id),
    event_category    TEXT,
    model             TEXT        NOT NULL,
    prompt_version    TEXT        NOT NULL,
    validation_status TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE extraction_parties
(
    id            SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
    name          TEXT    NOT NULL,
    role          TEXT,
    excerpt       TEXT
);

CREATE TABLE extraction_dates
(
    id            SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
    event_date    DATE    NOT NULL,
    description   TEXT,
    excerpt       TEXT
);

CREATE TABLE extraction_amounts
(
    id            SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
    amount        NUMERIC NOT NULL,
    currency      TEXT    NOT NULL DEFAULT 'USD',
    description   TEXT,
    excerpt       TEXT
);

CREATE TABLE extraction_excerpts
(
    id            SERIAL PRIMARY KEY,
    extraction_id INTEGER NOT NULL REFERENCES extractions (id) ON DELETE CASCADE,
    field         TEXT    NOT NULL,
    text          TEXT    NOT NULL
);