import {test} from "node:test";
import assert from "node:assert/strict";
import {isRealDate, validateExtraction, type ValidationResult} from "./validate";
import type {Extraction} from "./extraction-schema";

// fake 8-K, cover page then two item headings. newlines on purpose, normalize has to handle them
const FILING = `
EXAMPLE CORP
(Exact name of registrant as specified in its charter)
Item 5.02 Departure of Directors or Certain Officers.
On June 2, 2026, Jane Doe informed Example Corp of her decision to resign from the board.
She will receive a one-time payment of $250,000.
Item 9.01 Financial Statements and Exhibits.
`;

const EDGAR_ITEMS = ["5.02", "9.01"];

function cleanExtraction(): Extraction {
    return {
        items: [
            {
                item_number: "5.02",
                description: "director resigned",
                excerpt: "Item 5.02 Departure of Directors or Certain Officers."
            },
            {item_number: "9.01", description: "exhibits", excerpt: "Item 9.01 Financial Statements and Exhibits."},
        ],
        parties: [
            {
                name: "Jane Doe",
                role: "departing director",
                excerpt: "On June 2, 2026, Jane Doe informed Example Corp of her decision to resign from the board."
            },
        ],
        dates: [
            {
                date: "2026-06-02",
                description: "resignation notice",
                excerpt: "On June 2, 2026, Jane Doe informed Example Corp"
            },
        ],
        amounts: [
            {
                amount: 250000,
                currency: "USD",
                description: "one-time payment",
                excerpt: "She will receive a one-time payment of $250,000."
            },
        ],
    };
}

// match on part of the message so small wording changes don't break tests
function assertProblem(result: ValidationResult, part: string) {
    assert.equal(result.status, "invalid");
    assert.ok(result.problems.some((p) => p.includes(part)), `expected "${part}" in:\n${result.problems.join("\n")}`);
}

test("clean extraction is valid", () => {
    const result = validateExtraction(cleanExtraction(), FILING, EDGAR_ITEMS);
    assert.equal(result.status, "valid");
    assert.deepEqual(result.problems, []);
});

test("empty excerpt", () => {
    const extraction = cleanExtraction();
    extraction.amounts[0].excerpt = "";
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "empty excerpt");
});

test("excerpt not in the source", () => {
    const extraction = cleanExtraction();
    extraction.dates[0].excerpt = "On June 3, 2026, Jane Doe informed Example Corp";
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "excerpt not found in filing");
});

test("impossible date", () => {
    const extraction = cleanExtraction();
    extraction.dates[0].date = "2026-02-30";
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "not a real date");
});

test("amount that is not a finite number", () => {
    const extraction = cleanExtraction();
    extraction.amounts[0].amount = NaN;
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "not a finite number");
});

test("same item twice", () => {
    const extraction = cleanExtraction();
    extraction.items.push({...extraction.items[0]});
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "duplicate item 5.02");
});

test("no items", () => {
    const extraction = cleanExtraction();
    extraction.items = [];
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "no items reported");
});

test("missed an item EDGAR lists", () => {
    const extraction = cleanExtraction();
    extraction.items = extraction.items.filter((item) => item.item_number !== "9.01");
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "missed 9.01, EDGAR lists it");
});

test("item EDGAR does not list", () => {
    assertProblem(validateExtraction(cleanExtraction(), FILING, ["5.02"]), "9.01 is not in EDGAR's list");
});

test("no EDGAR list skips the item check", () => {
    // same gap as the missed-item test, but with null it should pass
    const extraction = cleanExtraction();
    extraction.items = extraction.items.filter((item) => item.item_number !== "9.01");
    const result = validateExtraction(extraction, FILING, null);
    assert.equal(result.status, "valid");
    assert.deepEqual(result.problems, []);
});

test("party name not in its excerpt", () => {
    const extraction = cleanExtraction();
    extraction.parties[0].name = "John Smith";
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "does not contain the name");
});

test("party excerpt only on the cover page", () => {
    const extraction = cleanExtraction();
    extraction.parties.push({
        name: "Example Corp",
        role: "registrant",
        excerpt: "EXAMPLE CORP (Exact name of registrant as specified in its charter)",
    });
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "only appears on the cover page");
});

test("party excerpt is only the name", () => {
    const extraction = cleanExtraction();
    extraction.parties[0].excerpt = "Jane Doe";
    assertProblem(validateExtraction(extraction, FILING, EDGAR_ITEMS), "excerpt is only the name");
});

test("extra whitespace in the excerpt still matches", () => {
    const extraction = cleanExtraction();
    extraction.parties[0].excerpt = "  On June 2, 2026,   Jane Doe\ninformed Example Corp of her decision to resign from the board. ";
    const result = validateExtraction(extraction, FILING, EDGAR_ITEMS);
    assert.equal(result.status, "valid");
    assert.deepEqual(result.problems, []);
});

test("isRealDate", () => {
    assert.equal(isRealDate("2026-02-30"), false); // js would roll this into march
    assert.equal(isRealDate("2028-02-29"), true); // leap year
    assert.equal(isRealDate("2026-13-01"), false);
    assert.equal(isRealDate("abc2026-02-03"), false);
});