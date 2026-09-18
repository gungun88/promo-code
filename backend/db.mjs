import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
// PostgreSQL DATE values are calendar dates, not instants in time. Keep the
// original YYYY-MM-DD string so timezone conversion cannot shift the day.
pg.types.setTypeParser(1082, (value) => value);
const __dirname = dirname(fileURLToPath(import.meta.url));
const databaseUrl =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === "production"
    ? ""
    : "postgresql://promo_code:promo-code-local-password@127.0.0.1:5432/promo_code");

const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.DATABASE_POOL_SIZE || 10),
  idleTimeoutMillis: 30_000,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initDatabase() {
  const schema = await fs.readFile(resolve(__dirname, "schema.sql"), "utf8");
  await query(schema);
}

export async function closeDatabase() {
  await pool.end();
}
