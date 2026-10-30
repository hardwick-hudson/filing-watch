export const ITEM_NUMBERS = [
    "1.01", "1.02", "1.03", "1.04", "1.05",
    "2.01", "2.02", "2.03", "2.04", "2.05", "2.06",
    "3.01", "3.02", "3.03",
    "4.01", "4.02",
    "5.01", "5.02", "5.03", "5.04", "5.05", "5.06", "5.07", "5.08",
    "6.01", "6.02", "6.03", "6.04", "6.05", "6.06",
    "7.01", "8.01", "9.01",
] as const;

export const extractionSchema = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    item_number: {type: "string", enum: ITEM_NUMBERS},
                    description: {type: "string"},
                    excerpt: {type: "string"},
                },
                required: ["item_number", "description", "excerpt"],
                additionalProperties: false,
            },
        },
        parties: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: {type: "string"},
                    role: {type: "string"},
                    excerpt: {type: "string"},
                },
                required: ["name", "role", "excerpt"],
                additionalProperties: false,
            },
        },
        dates: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    date: {type: "string", format: "date"},
                    description: {type: "string"},
                    excerpt: {type: "string"},
                },
                required: ["date", "description", "excerpt"],
                additionalProperties: false,
            },
        },
        amounts: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    amount: {type: "number"},
                    currency: {type: "string", pattern: "^[A-Z]{3}$"},
                    description: {type: "string"},
                    excerpt: {type: "string"},
                },
                required: ["amount", "currency", "description", "excerpt"],
                additionalProperties: false,
            },
        },
    },
    required: ["items", "parties", "dates", "amounts"],
    additionalProperties: false,
} as const;

export type Extraction = {
    items: { item_number: (typeof ITEM_NUMBERS)[number]; description: string; excerpt: string }[];
    parties: { name: string; role: string; excerpt: string }[];
    dates: { date: string; description: string; excerpt: string }[];
    amounts: { amount: number; currency: string; description: string; excerpt: string }[];
};