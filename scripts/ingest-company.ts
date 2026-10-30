import {closeDb, db} from "../lib/db";
import {fetchRecent8KFilings, fetchFilingText, sleep} from "../lib/edgar";

async function main() {
    const cik = process.argv[2];

    if (!cik) {
        console.error("Usage: npm run ingest -- CIK");
        process.exit(1);
    }

    const filings = await fetchRecent8KFilings(cik);

    if (filings.length === 0) {
        console.log(`Found no recent 8-K filings for CIK ${cik}.`);
        return;
    }

    const company = filings[0];

    await db.query(
        `
            INSERT INTO companies (cik, name)
            VALUES ($1, $2) ON CONFLICT (cik) DO
            UPDATE
                SET name = EXCLUDED.name
        `,
        [company.cik, company.companyName],
    );

    let inserted = 0;

    for (const filing of filings) {
        const result = await db.query(
            `
                INSERT INTO filings (accession_no,
                                     cik,
                                     form_type,
                                     filed_at,
                                     source_url)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (accession_no) DO NOTHING
            `,
            [
                filing.accessionNo,
                filing.cik,
                filing.formType,
                filing.filedAt,
                filing.sourceUrl,
            ],
        );

        inserted += result.rowCount ?? 0;
        await db.query(
            `UPDATE filings
             SET edgar_items = $1
             WHERE accession_no = $2
               AND edgar_items IS NULL`,
            [filing.items, filing.accessionNo],
        );
        const {rows} = await db.query(
            `SELECT raw_text IS NULL AS needs_text
             FROM filings
             WHERE accession_no = $1`,
            [filing.accessionNo],
        );
        if (rows[0]?.needs_text) {
            try {
                const text = await fetchFilingText(filing.sourceUrl);
                await db.query(
                    `UPDATE filings
                     SET raw_text = $1
                     WHERE accession_no = $2
                       and raw_text IS NULL`, // only fetch missing text, just fills nulls tho
                    [text, filing.accessionNo],
                );
            } catch (error) {
                console.error(`  text fetch failed for ${filing.accessionNo}:`, (error as Error).message);
            }

            await sleep(150);
        }
    }
    console.log(`Fetched ${filings.length} recent 8-K filings.`);
    console.log(`Inserted ${inserted} new filings.`);

}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb();
    });