/**
 * One-shot local bootstrap: .env.local, npm install, create DB if missing, migrate, next dev.
 * Run from project root: npm run start:scratch
 */
import { spawn } from "child_process";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

process.chdir(root);

const envLocal = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");

function runNpmInstall() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`npm install exited with code ${code}`));
    });
  });
}

function escapeIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists(connectionString) {
  let client;
  try {
    client = new pg.Client({ connectionString });
    await client.connect();
    await client.end();
    return;
  } catch (err) {
    await client?.end().catch(() => {});
    if (err && err.code === "3D000") {
      // invalid_catalog_name — database missing
    } else if (err && err.code === "ECONNREFUSED") {
      console.error("");
      console.error("Cannot reach PostgreSQL (connection refused).");
      console.error("Start PostgreSQL first, then re-run this script.");
      console.error("See README.md (Prerequisites) for install hints.");
      console.error("");
      process.exit(1);
    } else {
      throw err;
    }
  }

  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  const rawPath = url.pathname.replace(/^\//, "");
  const dbName = decodeURIComponent(rawPath.split("/")[0] || "");
  if (!dbName) {
    throw new Error("Could not parse database name from DATABASE_URL pathname");
  }

  const adminDbs = ["postgres", "template1"];
  let adminClient;
  let lastErr;
  for (const adminDb of adminDbs) {
    url.pathname = "/" + adminDb;
    const adminUrl = url.href;
    try {
      adminClient = new pg.Client({ connectionString: adminUrl });
      await adminClient.connect();
      break;
    } catch (e) {
      lastErr = e;
      adminClient = undefined;
    }
  }
  if (!adminClient) {
    console.error("Could not connect to a maintenance database (postgres / template1).");
    if (lastErr) console.error(lastErr.message || lastErr);
    process.exit(1);
  }

  try {
    await adminClient.query(`CREATE DATABASE ${escapeIdent(dbName)}`);
    console.log(`Created database ${dbName}.`);
  } catch (e) {
    if (e && e.code === "42P04") {
      console.log(`Database ${dbName} already exists.`);
    } else {
      throw e;
    }
  } finally {
    await adminClient.end();
  }
}

if (!fs.existsSync(envLocal)) {
  if (!fs.existsSync(envExample)) {
    console.error("Missing .env.example — cannot create .env.local.");
    process.exit(1);
  }
  fs.copyFileSync(envExample, envLocal);
  console.log("Created .env.local from .env.example (edit DATABASE_URL if needed).\n");
}

dotenv.config({ path: envLocal });
dotenv.config({ path: path.join(root, ".env") });

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.error("DATABASE_URL is missing in .env.local.");
  process.exit(1);
}

console.log("Installing npm dependencies…\n");
await runNpmInstall();

console.log("\nChecking PostgreSQL / database…");
await ensureDatabaseExists(DATABASE_URL);

console.log("\nApplying database migrations…");
await import("./migrate.mjs");
if (process.exitCode === 1) {
  process.exit(1);
}

console.log("\nStarting Next.js…\n");
const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  cwd: root,
  env: { ...process.env },
});

next.on("exit", (code) => process.exit(code ?? 0));
