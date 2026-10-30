import { Pool, PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("Missing DATABASE_URL in environment");
}

export const db = new Pool({
    connectionString,
});

export async function closeDb() {
    await db.end();
}

export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await db.connect();

    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }finally{
        client.release();
    }
}
