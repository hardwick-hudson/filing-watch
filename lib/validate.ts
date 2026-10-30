import type {Extraction} from "./extraction-schema";

export type ValidationResult = {
    status: "valid" | "invalid";
    problems: string[];
};

function normalize(text: string): string {
    return text.replace(/\s+/g, " ").trim(); // raw_text is already collapsed, this just evens out the model
}

export function isRealDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    // js rolls 2026-02-30 into march, round trip and compare
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateExtraction(extraction: Extraction, rawText: string): ValidationResult {
    const problems: string[] = [];
    const source = normalize(rawText);

    function checkExcerpt(label: string, excerpt: string) {
        const text = normalize(excerpt);

        if (text === "") {
            problems.push(`${label}: empty excerpt`); // includes ("") always true, have to catch first
        } else if (!source.includes(text)) {
            problems.push(`${label}: excerpt not found in filing: "${text.slice(0, 80)}"`);
        }
    }

    if (extraction.items.length === 0) {
        problems.push("items: no items reported");
    }

    const seenItems = new Set<string>();

    for (const [i, item] of extraction.items.entries()) {
        checkExcerpt(`items[${i}] ${item.item_number}`, item.excerpt);

        // dupes would hit the unique constraint and kill the whole transaction
        if (seenItems.has(item.item_number)) {
            problems.push(`items[${i}]: duplicate item ${item.item_number}`);
        }

        seenItems.add(item.item_number);
    }

    for (const [i, party] of extraction.parties.entries()) {
        checkExcerpt(`parties[${i}] ${party.name}`, party.excerpt);

        //excerpt has to actually name them, not just be somewhere in filing
        if (!normalize(party.excerpt).toLowerCase().includes(normalize(party.name).toLowerCase())){
            problems.push(`parties[${i}]: excerpt does not contain the name "${party.name}"`);
        }
    }

    for (const [i, entry] of extraction.dates.entries()) {
        checkExcerpt(`dates[${i}] ${entry.date}`, entry.excerpt);

        if (!isRealDate(entry.date)) {
            problems.push(`dates[${i}]: not a real date: ${entry.date}`);
        }
    }

    for (const [i, entry] of extraction.amounts.entries()) {
        checkExcerpt(`amounts[${i}] ${entry.amount}`, entry.excerpt);

        if (!Number.isFinite(entry.amount)) {
            problems.push(`amounts[${i}]: not a finite number: ${entry.amount}`);
        }
    }

    return {
        status: problems.length === 0 ? "valid" : "invalid",
        problems,
    };
}