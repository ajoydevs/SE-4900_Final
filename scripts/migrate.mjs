import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env.local.");
  process.exit(1);
}

function isConnectionRefused(err) {
  if (!err) return false;
  if (err.code === "ECONNREFUSED") return true;
  if (Array.isArray(err.errors)) {
    return err.errors.some((e) => e && e.code === "ECONNREFUSED");
  }
  return false;
}

function printPostgresHelp() {
  console.error("");
  console.error("Cannot reach PostgreSQL (connection refused on DATABASE_URL).");
  console.error("The server is not running, or the host/port in .env.local is wrong.");
  console.error("");
  console.error("On macOS with Homebrew, for example:");
  console.error("  brew install postgresql@16");
  console.error("  brew services start postgresql@16");
  console.error("  createdb docsync");
  console.error("");
  console.error("Or use Postgres.app: https://postgresapp.com — start the app, then createdb docsync.");
  console.error("");
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
} catch (err) {
  if (isConnectionRefused(err)) {
    printPostgresHelp();
    process.exit(1);
  }
  throw err;
}

try {
  await client.query(`
    create table if not exists schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);

  const { rows } = await client.query(
    `select 1 from schema_migrations where version = $1`,
    ["001_local_postgres"]
  );
  if (rows.length > 0) {
    console.log("Database migrations already applied.");
  } else {
    const sqlPath = path.join(root, "db/migrations/001_local_postgres.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query(`insert into schema_migrations (version) values ($1)`, [
      "001_local_postgres",
    ]);
    await client.query("COMMIT");
    console.log("Applied migration 001_local_postgres.");
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}

if (process.exitCode === 1) {
  process.exit(1);
}
