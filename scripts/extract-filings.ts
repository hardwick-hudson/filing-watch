import {closeDb, db, withTransaction} from "../lib/db";
import {extractFiling, EXTRACTION_MODEL, PROMPT_VERSION} from "../lib/extract";
import {isRealDate, validateExtraction} from "../lib/validate";

// haiku 5.5 list price as of oct 2026. just for log, console has real bill
const INPUT_PRICE = 0.1 / 1_000_000;
const OUTPUT_PRICE = 0.5 / 1_000_000;

const MAX_ATTEMPTS = 3;

type PendingFiling = {
    id: number;
    accession_no: string;
    raw_text: string;
};

async function main() {
    const limit = Number(process.argv[2] ?? 5); // small default so one bad run can't eat the cap
    if (!Number.isInteger(limit) || limit < 1) {
        console.error("Usage: npm run extract -- [limit]");
        process.exit(1);
    }

    const {rows: filings} = await db.query<PendingFiling>(
        `SELECT f.id, f.accession_no, f.raw_text
         FROM filings f
         WHERE f.raw_text IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM extractions e WHERE e.filing_id = f.id AND e.prompt_version = $3 AND e.validation_status <> 'error')
           AND (SELECT count(*) FROM extractions e WHERE e.filing_id = f.id AND e.prompt_version = $3 AND e.validation_status = 'error') < $2
         ORDER BY f.filed_at DESC
             LIMIT $1`,
        [limit, MAX_ATTEMPTS, PROMPT_VERSION],
    );

    console.log(`Found ${filings.length} filings to extract.`);

    let inputTokens = 0;
    let outputTokens = 0;

    for (const filing of filings) {
        try {
            const result = await extractFiling(filing.raw_text);
            const validation = validateExtraction(result.extraction, filing.raw_text);
            const {items, parties, dates, amounts} = result.extraction;

            // count before write, api charged even if insert fails
            inputTokens += result.inputTokens;
            outputTokens += result.outputTokens;

            await withTransaction(async (client) => {
                const {rows} = await client.query<{ id: number }>(
                    `INSERT INTO extractions (filing_id, model, prompt_version, validation_status)
                     VALUES ($1, $2, $3, $4) RETURNING id`,
                    [filing.id, result.model, PROMPT_VERSION, validation.status],
                );
                const extractionId = rows[0].id;

                for (const item of items) {
                    await client.query(
                        `INSERT INTO extraction_items (extraction_id, item_number, description, excerpt)
                         VALUES ($1, $2, $3, $4) ON CONFLICT (extraction_id, item_number) DO NOTHING`, // dupes already flagged in validate, just don't crash on them
                        [extractionId, item.item_number, item.description, item.excerpt],
                    );
                }
                for (const party of parties) {
                    await client.query(
                        `INSERT INTO extraction_parties (extraction_id, name, role, excerpt)
                         VALUES ($1, $2, $3, $4)`,
                        [extractionId, party.name, party.role, party.excerpt],
                    );
                }
                for (const entry of dates) {
                    if (!isRealDate(entry.date)) {
                        continue; // postgres rejects 02-30 and would roll back the whole extraction
                    }
                    await client.query(
                        `INSERT INTO extraction_dates (extraction_id, event_date, description, excerpt)
                         VALUES ($1, $2, $3, $4)`,
                        [extractionId, entry.date, entry.description, entry.excerpt],
                    );
                }
                for (const entry of amounts) {
                    await client.query(
                        `INSERT INTO extraction_amounts (extraction_id, amount, currency, description, excerpt)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [extractionId, entry.amount, entry.currency, entry.description, entry.excerpt],
                    );
                }
            });
            console.log(`${filing.accession_no}: ${validation.status} (${result.inputTokens} in / ${result.outputTokens} out)`);

            for (const problem of validation.problems) {
                console.log(`  - ${problem}`);
            }
        } catch (error) {
            const message = (error as Error).message;
            console.error(`${filing.accession_no}: failed:`, message);

            // outside the transaction on purpose, failed one already rolled back
            await db.query(
                `INSERT INTO extractions (filing_id, model, prompt_version, validation_status, error_message)
                 VALUES ($1, $2, $3, 'error', $4)`,
                [filing.id, EXTRACTION_MODEL, PROMPT_VERSION, message],
            );
        }
    }

    const cost = inputTokens * INPUT_PRICE + outputTokens * OUTPUT_PRICE;
    console.log(`Tokens: ${inputTokens} in / ${outputTokens} out, about $${cost.toFixed(4)}`);
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb();
    });