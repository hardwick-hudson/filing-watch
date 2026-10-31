# filing-watch

Pulls 8-K filings from SEC EDGAR, has Claude pull out the key facts (8-K items, parties, dates, dollar amounts), and
stores them next to the filing's text. Every fact has to come with an exact quote from the filing, so you can check
where it came from. If a quote isn't in the filing, the result gets marked invalid.

## Status

Still building. What works right now:

- Ingestion: grabs a company's recent 8-Ks from EDGAR, along with the item list EDGAR gives for each one and a
  cleaned-up copy of the filing text.
- Extraction: sends the filing text to Claude with a strict JSON schema, checks the output, and saves it
- Validation: checks every quote against the filing before anything is marked valid

Building next:

- Reading exhibits so earnings filings get their dollar amounts

Not done yet:

- The UI
- Deploying it

## Stack

Next.js (App Router) · TypeScript · PostgreSQL · Anthropic API (Claude Haiku) · cheerio for cleaning filing HTML

## Running it locally

You need Node.js 20.9+, PostgreSQL, and an Anthropic API key.

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `SEC_USER_AGENT` (your name and email, the SEC asks for it),
   `DATABASE_URL` and `ANTHROPIC_API_KEY`
3. Make the database: `createdb filing_watch`
4. Load the schema: `psql filing_watch -f migrations/001_init.sql`

## Usage

```bash
npm run ingest -- 320193     # pull a company's recent 8-Ks by CIK (320193 is Apple)
npm run extract -- 5         # extract the 5 newest filings not done yet (for current prompt version)
npm run extract -- 5 5.02    # only filings that EDGAR lists with item 5.02
```

`extract` calls the Anthropic API. It uses Haiku, which is cheap, but set a spend limit on your API key anyway. With no
number it does 5.

Each result is tagged with the prompt version that made it. When I change the prompt I bump the version, and the next
runs of `extract` do each filing again under the new one. Keeping the old results for now so I can compare versions.

## How extraction works

1. The filing text goes to Claude with a JSON schema that locks down the output: items, parties, dates and amounts, each
   with a quote from the filing backing it up.
2. Then the output gets checked: every quote has to be in the filing word for word, every party's quote has to actually
   name them, dates have to be real calendar dates, and no item can show up twice.
3. It's saved in one transaction as `valid` or `invalid`. I keep invalid ones so I can see what went wrong. If the call
   or the save fails, the run is saved as `error` and the filing gets tried again on a later run, up to three times per
   prompt version.

## Data model

Main tables: `companies`, `filings`, and `extractions`. A filing can have several extractions: one per prompt version,
plus any failed runs. Each extraction stores the model and prompt version that made it, and its status (`valid`,
`invalid` or `error`).

The extracted facts live in four tables: `extraction_items`, `extraction_parties`, `extraction_dates`, and
`extraction_amounts`. Every row has its own quote from the filing, so each fact can be checked on its own.

## Limitations

- It only reads the main document of each filing, not the exhibits. A lot of 8-Ks, especially earnings, put the actual
  numbers in Exhibit 99.1, so dollar amounts are often empty for those.
- It only looks at the recent filings list from EDGAR's submissions API, not a company's full history.
- I've only tested the prompt on a small set of Apple and Microsoft filings, mostly earnings releases and investor
  presentations.