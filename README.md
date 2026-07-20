# filing-watch

Turns SEC 8-K filings into a scannable feed of structured events. Pulls
filings from EDGAR, extracts the key facts (event type, parties, dates,
dollar amounts) with an LLM, and stores each result alongside the source
text so every extracted claim can be traced back to the filing.

## Status

In progress. Working now:

- Next.js app scaffolded and running locally

Building next:

- EDGAR ingestion: fetch and store 8-K filings for a given company (CIK)


Not built yet:

- LLM extraction pipeline
- List and source-vs-extraction detail views
- Deployment

## Stack

Next.js (App Router) · TypeScript · PostgreSQL · Anthropic API

## Running locally

Requires a local PostgreSQL database and an Anthropic API key.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` and
   `ANTHROPIC_API_KEY`
3. Apply the schema: `psql filing_watch -f migrations/001_init.sql`
4. `npm run dev`

## Data model

Core tables: `companies`, `filings`, and `extractions`.

Extraction details that can have multiple values are stored in child tables:
`extraction_parties`, `extraction_dates`, `extraction_amounts`, and
`extraction_excerpts`. Each extraction records the model and prompt version
that produced it.