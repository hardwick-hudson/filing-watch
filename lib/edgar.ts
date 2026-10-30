import * as cheerio from "cheerio";

type EdgarSubmission = {
    cik: string;
    name: string;
    filings: {
        recent: {
            accessionNumber: string[];
            filingDate: string[];
            form: string[];
            primaryDocument: string[];
        };
    };
};

export type EdgarFiling = {
    accessionNo: string;
    cik: string;
    companyName: string;
    formType: string;
    filedAt: string;
    sourceUrl: string;
};

function requireUserAgent(): string {
    const userAgent = process.env.SEC_USER_AGENT;

    if (!userAgent) {
        throw new Error("Missing SEC_USER_AGENT in environment");
    }

    return userAgent;
}

function cikForSubmissionsUrl(cik: string): string {
    return cik.padStart(10, "0");
}

function cikForArchivesUrl(cik: string): string {
    return String(Number(cik));
}

function filingDocumentUrl(cik: string, accessionNo: string, primaryDocument: string): string {
    const archiveCik = cikForArchivesUrl(cik);
    const accessionPath = accessionNo.replaceAll("-", "");

    return `https://www.sec.gov/Archives/edgar/data/${archiveCik}/${accessionPath}/${primaryDocument}`;
}

export async function fetchCompanySubmissions(cik: string): Promise<EdgarSubmission> {
    const paddedCik = cikForSubmissionsUrl(cik);

    const response = await fetch(`https://data.sec.gov/submissions/CIK${paddedCik}.json`, {
        headers: {
            "User-Agent": requireUserAgent(),
            Accept: "application/json",
        },
    });

    if (!response.ok) {
        throw new Error(`SEC submissions request failed: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<EdgarSubmission>;
}

export async function fetchRecent8KFilings(cik: string): Promise<EdgarFiling[]> {
    const submissions = await fetchCompanySubmissions(cik);
    const recent = submissions.filings.recent;
    const filings: EdgarFiling[] = [];

    for (let index = 0; index < recent.accessionNumber.length; index += 1) {
        if (recent.form[index] !== "8-K") {
            continue;
        }

        filings.push({
            accessionNo: recent.accessionNumber[index],
            cik: submissions.cik,
            companyName: submissions.name,
            formType: recent.form[index],
            filedAt: recent.filingDate[index],
            sourceUrl: filingDocumentUrl(
                submissions.cik,
                recent.accessionNumber[index],
                recent.primaryDocument[index],
            ),
        });
    }

    return filings;
}

export async function fetchFilingText(sourceUrl: string): Promise<string> {

    const res = await fetch(sourceUrl, {
        headers: {"User-Agent": requireUserAgent()},
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch ${sourceUrl}: ${res.status} ${res.statusText}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style").remove();
    $("ix\\:header").remove();
    $('[style*="display:none"], [style*="display: none"]').remove();
    $("br").replaceWith(" ");
    $("p, div, td, th, tr, li, h1, h2, h3, h4, h5, h6").append(" ");
    return $("body").text().replace(/\s+/g, " ").trim();
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}