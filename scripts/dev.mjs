import { spawn } from "child_process";
import { execSync } from "child_process";
import dotenv from "dotenv";
import { createConnection } from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

process.chdir(root);

dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

function dbAddr() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    return { host: "127.0.0.1", port: 5432 };
  }
  try {
    const u = new URL(raw);
    return {
      host: u.hostname || "127.0.0.1",
      port: Number(u.port || 5432),
    };
  } catch {
    return { host: "127.0.0.1", port: 5432 };
  }
}

function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function tryOnce() {
      const socket = createConnection({ host, port }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() > deadline) {
          reject(
            new Error(
              `Timed out waiting for PostgreSQL at ${host}:${port}. Check Docker and DATABASE_URL.`
            )
          );
          return;
        }
        setTimeout(tryOnce, 300);
      });
    }
    tryOnce();
  });
}

try {
  execSync("docker compose up -d", { stdio: "inherit", cwd: root });
} catch {
  console.error("Could not run `docker compose up -d`. Is Docker running?");
  process.exit(1);
}

const { host, port } = dbAddr();
console.log(`Waiting for database at ${host}:${port}…`);
await waitForPort(host, port, 60_000);

await import("./migrate.mjs");

const next = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  cwd: root,
  env: { ...process.env },
});

next.on("exit", (code) => process.exit(code ?? 0));
